import { Worker, Job } from 'bullmq';
import { redisConnection } from './config/redis.js';
import { prisma } from './lib/prisma.js';
import { sendEmail, closeTransports } from './lib/mailer.js';
import {
  checkAndIncrementHourlyLimit,
  reserveSenderSpacingSlot,
  triggerSlackRateLimitAlertIfNeeded,
} from './services/rateLimiter.js';
import { indexEmailRecord } from './services/elasticsearchService.js';
import {
  EMAIL_QUEUE_NAME,
  EmailJobPayload,
  emailQueue,
  addEmailJob,
} from './queues/emailQueue.js';
import { reconcileScheduledEmails } from './queues/reconcile.js';
import { ENV } from './config/env.js';

export function createEmailWorker() {
  console.log(`[Worker] Initializing ReachInbox Email Worker (Concurrency: ${ENV.WORKER_CONCURRENCY})...`);

  // Run initial DB-to-Queue reconciliation to recover any lost or orphan jobs on start
  reconcileScheduledEmails().catch((err) => {
    console.error('[Worker] Initial reconciliation error:', err.message);
  });

  const worker = new Worker<EmailJobPayload>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobPayload>) => {
      const { emailId, userId, sender, recipient, subject, body, hourlyLimit, delayBetweenEmailsMs } = job.data;
      const normalizedSender = sender.trim().toLowerCase();
      const normalizedRecipient = recipient.trim().toLowerCase();

      console.log(`[Worker] >>> Processing Job ${job.id} for email ${emailId} -> ${normalizedRecipient}`);

      const emailRecord = await prisma.emailJob.findUnique({
        where: { id: emailId },
      });

      if (!emailRecord) {
        console.warn(`[Worker] Email record ${emailId} not found in database. Skipping.`);
        return { skipped: true, reason: 'Record not found' };
      }

      // 1. Idempotency Check: Prevent duplicate send if already marked SENT or FAILED
      if (emailRecord.status === 'SENT' || emailRecord.status === 'FAILED') {
        console.log(`[Worker] Email ${emailId} is already ${emailRecord.status}. Skipping.`);
        return { skipped: true, reason: `Already ${emailRecord.status}` };
      }

      // 2. Interrupted send detection (at-most-once guarantee)
      if (emailRecord.status === 'PROCESSING') {
        // A previous attempt crashed mid-send. To prevent duplicate outreach, mark FAILED
        await prisma.emailJob.updateMany({
          where: { id: emailId, status: 'PROCESSING' },
          data: {
            status: 'FAILED',
            failedAt: new Date(),
            failureReason: 'Send was interrupted during process execution; marked failed to prevent duplicate send.',
          },
        });
        console.warn(`[Worker] Interrupted send detected for ${emailId}. Marked as FAILED (at-most-once safety).`);
        return { failed: true, reason: 'Interrupted send' };
      }

      // 3. Atomic Per-Sender Hourly Rate Limit Check
      const effectiveLimit = hourlyLimit || ENV.MAX_EMAILS_PER_HOUR_PER_SENDER;
      const rateLimit = await checkAndIncrementHourlyLimit(normalizedSender, effectiveLimit);

      if (!rateLimit.allowed) {
        console.warn(
          `[Worker] Rate limit reached for sender "${normalizedSender}" (${rateLimit.currentCount}/${effectiveLimit}). Rescheduling job into next hour window (${Math.round(rateLimit.msUntilNextHour / 1000)}s).`
        );

        // Reschedule into next hour window instead of dropping
        const rescheduleDelayMs = rateLimit.msUntilNextHour;
        const rescheduledJob = await addEmailJob(
          job.data,
          rescheduleDelayMs,
          `rescheduled_${emailId}_${Date.now()}`
        );

        await prisma.emailJob.update({
          where: { id: emailId },
          data: {
            status: 'DELAYED',
            scheduledAt: new Date(Date.now() + rescheduleDelayMs),
            bullmqJobId: rescheduledJob.id?.toString(),
          },
        });

        // Send deduplicated Slack alert
        await triggerSlackRateLimitAlertIfNeeded(userId, normalizedSender, effectiveLimit);

        // Update Elasticsearch record
        indexEmailRecord({
          id: emailRecord.id,
          userId: emailRecord.userId,
          sender: emailRecord.sender,
          recipient: emailRecord.recipient,
          subject: emailRecord.subject,
          body: emailRecord.body,
          status: 'DELAYED',
          scheduledAt: new Date(Date.now() + rescheduleDelayMs),
          createdAt: emailRecord.createdAt,
        }).catch(() => {});

        return {
          rescheduled: true,
          reason: 'Rate limit exceeded',
          nextAttemptInMs: rescheduleDelayMs,
        };
      }

      // 4. Concurrency-Safe Sender Spacing Slot Allocation (Redis Lua)
      const minDelay = delayBetweenEmailsMs || ENV.MIN_EMAIL_DELAY_MS;
      if (minDelay > 0) {
        const spacing = await reserveSenderSpacingSlot(normalizedSender, minDelay);
        if (spacing.waitMs > 25) {
          console.log(`[Worker] Enforcing atomic spacing slot for ${normalizedSender}: waiting ${spacing.waitMs}ms`);
          await new Promise((resolve) => setTimeout(resolve, spacing.waitMs));
        }
      }

      // 5. ATOMIC CLAIM: Only ONE worker instance that flips status -> PROCESSING may send
      const claim = await prisma.emailJob.updateMany({
        where: {
          id: emailId,
          status: { in: ['SCHEDULED', 'DELAYED'] },
        },
        data: {
          status: 'PROCESSING',
          retryCount: { increment: 1 },
        },
      });

      if (claim.count === 0) {
        console.log(`[Worker] Email ${emailId} was claimed by another worker or state changed. Skipping.`);
        return { skipped: true, reason: 'Already claimed' };
      }

      try {
        // 6. Send Email via Nodemailer & Ethereal SMTP with stable Message-ID
        const sendResult = await sendEmail({
          emailId,
          from: normalizedSender,
          to: normalizedRecipient,
          subject,
          html: body,
        });

        if (!sendResult.messageId) {
          throw new Error('SMTP did not return a valid messageId.');
        }

        const sentAt = new Date();

        // 7. Persist SENT status, messageId, and preview URL in DB
        const updated = await prisma.emailJob.update({
          where: { id: emailId },
          data: {
            status: 'SENT',
            sentAt,
            messageId: sendResult.messageId,
            previewUrl: sendResult.previewUrl,
            failureReason: null,
          },
        });

        console.log(
          `[Worker] Successfully sent email ${emailId} to ${normalizedRecipient}! MessageID: ${sendResult.messageId} | Preview: ${sendResult.previewUrl || 'N/A'}`
        );

        // 8. Update Elasticsearch
        indexEmailRecord({
          id: updated.id,
          userId: updated.userId,
          sender: updated.sender,
          recipient: updated.recipient,
          subject: updated.subject,
          body: updated.body,
          status: 'SENT',
          scheduledAt: updated.scheduledAt,
          sentAt,
          previewUrl: sendResult.previewUrl,
          createdAt: updated.createdAt,
        }).catch(() => {});

        return {
          success: true,
          messageId: sendResult.messageId,
          previewUrl: sendResult.previewUrl,
        };
      } catch (err: any) {
        console.error(`[Worker Error] Failed sending email ${emailId} to ${normalizedRecipient}:`, err.message);

        const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts || 3);

        if (isFinalAttempt) {
          await prisma.emailJob.update({
            where: { id: emailId },
            data: {
              status: 'FAILED',
              failedAt: new Date(),
              failureReason: err.message,
            },
          });

          indexEmailRecord({
            id: emailRecord.id,
            userId: emailRecord.userId,
            sender: emailRecord.sender,
            recipient: emailRecord.recipient,
            subject: emailRecord.subject,
            body: emailRecord.body,
            status: 'FAILED',
            scheduledAt: emailRecord.scheduledAt,
            failedAt: new Date(),
            createdAt: emailRecord.createdAt,
          }).catch(() => {});
        } else {
          // Release atomic claim back to SCHEDULED so retry can proceed
          await prisma.emailJob.update({
            where: { id: emailId },
            data: {
              status: 'SCHEDULED',
              failureReason: err.message,
            },
          });
        }

        throw err; // BullMQ triggers exponential backoff retry
      }
    },
    {
      connection: redisConnection,
      concurrency: ENV.WORKER_CONCURRENCY,
      lockDuration: 30000,
    }
  );

  worker.on('completed', (job: Job) => {
    console.log(`[Worker] Job ${job.id} completed.`);
  });

  worker.on('failed', (job: Job | undefined, err: Error) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err: Error) => {
    console.error('[Worker Fatal Error]', err.message);
  });

  return worker;
}

export const emailWorker = createEmailWorker();

/**
 * Graceful shutdown logic: waits for in-flight jobs to finish, closes connections.
 */
export async function shutdownWorker(signal = 'SIGTERM') {
  console.log(`[Worker] Received ${signal}. Gracefully stopping worker and closing pools...`);
  try {
    await emailWorker.close();
    await emailQueue.close();
    closeTransports();
    await redisConnection.quit();
    await prisma.$disconnect();
    console.log('[Worker] Graceful shutdown complete.');
  } catch (err: any) {
    console.error('[Worker] Error during shutdown:', err.message);
  }
}

// Standalone runner execution
const isMain = process.argv[1] && (process.argv[1].endsWith('worker.ts') || process.argv[1].endsWith('worker.js'));
if (isMain) {
  console.log('[Worker] Running in standalone process mode.');
  process.on('SIGINT', () => void shutdownWorker('SIGINT').then(() => process.exit(0)));
  process.on('SIGTERM', () => void shutdownWorker('SIGTERM').then(() => process.exit(0)));
}
