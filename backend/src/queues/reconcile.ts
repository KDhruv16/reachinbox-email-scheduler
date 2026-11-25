import { prisma } from '../lib/prisma.js';
import { emailQueue, addEmailJob } from './emailQueue.js';

/**
 * Postgres is the single source of truth.
 * On worker or server startup, verify that every email marked SCHEDULED or DELAYED
 * has an active job in Redis.
 *
 * If Redis lost data or the server crashed before BullMQ enqueued it,
 * this function automatically recovers the job and ensures it gets dispatched.
 */
export async function reconcileScheduledEmails(): Promise<{ restored: number; orphansCleaned: number }> {
  console.log('[Reconcile] Starting database to BullMQ queue reconciliation check...');

  let restored = 0;
  let orphansCleaned = 0;

  try {
    // 1. Clean up any jobs that were stuck in PROCESSING when the previous process died
    const stuckProcessing = await prisma.emailJob.findMany({
      where: { status: 'PROCESSING' },
      select: { id: true, recipient: true },
    });

    for (const orphan of stuckProcessing) {
      await prisma.emailJob.update({
        where: { id: orphan.id },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          failureReason: 'Worker process stopped unexpectedly during send; marked as failed to prevent duplicate send.',
        },
      });
      orphansCleaned++;
      console.warn(`[Reconcile] Orphaned in-flight job ${orphan.id} to ${orphan.recipient} marked as FAILED.`);
    }

    // 2. Find all pending jobs that should be in the queue
    const pendingEmails = await prisma.emailJob.findMany({
      where: {
        status: { in: ['SCHEDULED', 'DELAYED'] },
      },
      select: {
        id: true,
        userId: true,
        sender: true,
        recipient: true,
        subject: true,
        body: true,
        scheduledAt: true,
        hourlyLimit: true,
        delayBetweenEmailsMs: true,
        bullmqJobId: true,
        idempotencyKey: true,
      },
      orderBy: { scheduledAt: 'asc' },
      take: 1000,
    });

    if (pendingEmails.length === 0) {
      console.log('[Reconcile] No pending emails found in database. Queue is in sync.');
      return { restored, orphansCleaned };
    }

    for (const email of pendingEmails) {
      const jobId = email.bullmqJobId || `email_${email.id}`;
      const existingJob = await emailQueue.getJob(jobId);

      let needsReenqueue = false;
      if (!existingJob) {
        needsReenqueue = true;
      } else {
        const state = await existingJob.getState();
        if (state === 'completed' || state === 'failed') {
          await existingJob.remove();
          needsReenqueue = true;
        }
      }

      if (needsReenqueue) {
        const delayMs = Math.max(0, email.scheduledAt.getTime() - Date.now());
        const job = await addEmailJob(
          {
            emailId: email.id,
            userId: email.userId,
            sender: email.sender,
            recipient: email.recipient,
            subject: email.subject,
            body: email.body,
            hourlyLimit: email.hourlyLimit,
            delayBetweenEmailsMs: email.delayBetweenEmailsMs,
            idempotencyKey: email.idempotencyKey,
          },
          delayMs,
          jobId
        );

        await prisma.emailJob.update({
          where: { id: email.id },
          data: { bullmqJobId: job.id?.toString() },
        });

        restored++;
        console.log(`[Reconcile] Re-enqueued missing job for email ${email.id} (Delay: ${Math.round(delayMs / 1000)}s)`);
      }
    }

    if (restored > 0 || orphansCleaned > 0) {
      console.log(`[Reconcile] Reconciliation complete. Restored: ${restored}, Cleaned orphans: ${orphansCleaned}`);
    } else {
      console.log('[Reconcile] All database records match active BullMQ queue state.');
    }
  } catch (err: any) {
    console.error('[Reconcile Error] Failed during reconciliation:', err.message);
  }

  return { restored, orphansCleaned };
}
