import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { addEmailJob, emailQueue } from '../queues/emailQueue.js';
import { indexEmailRecord, searchEmails } from './elasticsearchService.js';
import { ENV } from '../config/env.js';

export interface ScheduleEmailInput {
  userId: string;
  sender?: string;
  recipients: string[];
  subject: string;
  body: string;
  startTime?: string | Date;
  delayBetweenEmailsMs?: number;
  hourlyLimit?: number;
  batchId?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim().toLowerCase());
}

export function generateIdempotencyKey(
  userId: string,
  sender: string,
  recipient: string,
  subject: string,
  body: string,
  scheduledTimeMs: number,
  clientBatchId?: string
): string {
  if (clientBatchId && clientBatchId.trim().length > 0) {
    return `${userId}_${clientBatchId.trim()}_${recipient.trim().toLowerCase()}`;
  }

  const contentHash = crypto
    .createHash('sha256')
    .update(`${subject.trim()}:${body.trim()}`)
    .digest('hex')
    .substring(0, 16);

  // Bucket scheduled time to 2-minute window to avoid duplicate clicks creating separate keys
  const roundedTimeBucket = Math.floor(scheduledTimeMs / 120000);
  return `${userId}_${sender.trim().toLowerCase()}_${recipient.trim().toLowerCase()}_${contentHash}_${roundedTimeBucket}`;
}

export async function scheduleEmails(input: ScheduleEmailInput) {
  const {
    userId,
    sender = 'notifications@reachinbox.ai',
    recipients,
    subject,
    body,
    startTime,
    delayBetweenEmailsMs = ENV.MIN_EMAIL_DELAY_MS,
    hourlyLimit = ENV.MAX_EMAILS_PER_HOUR_PER_SENDER,
    batchId,
  } = input;

  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    throw new Error('At least one recipient email address is required');
  }

  if (!subject || subject.trim().length === 0) {
    throw new Error('Email subject is required');
  }

  if (!body || body.trim().length === 0) {
    throw new Error('Email body is required');
  }

  // Deduplicate and validate recipients
  const validRecipients = Array.from(
    new Set(
      recipients
        .map((r) => r.trim().toLowerCase())
        .filter((r) => validateEmail(r))
    )
  );

  if (validRecipients.length === 0) {
    throw new Error('No valid email recipients found');
  }

  const startTimestamp = startTime ? new Date(startTime).getTime() : Date.now();
  const baseTime = Math.max(Date.now(), startTimestamp);
  const normalizedSender = sender.trim().toLowerCase();

  const scheduledJobs = [];
  const skippedDuplicates = [];

  for (let i = 0; i < validRecipients.length; i++) {
    const recipient = validRecipients[i];
    const scheduledAtMs = baseTime + i * delayBetweenEmailsMs;
    const scheduledAt = new Date(scheduledAtMs);
    const initialDelayMs = Math.max(0, scheduledAtMs - Date.now());

    const idempotencyKey = generateIdempotencyKey(
      userId,
      normalizedSender,
      recipient,
      subject,
      body,
      scheduledAtMs,
      batchId
    );

    const existingRecord = await prisma.emailJob.findUnique({
      where: { idempotencyKey },
    });

    if (existingRecord) {
      skippedDuplicates.push({
        recipient,
        idempotencyKey,
        existingId: existingRecord.id,
        status: existingRecord.status,
      });
      continue;
    }

    const emailRecord = await prisma.emailJob.create({
      data: {
        userId,
        sender: normalizedSender,
        recipient,
        subject: subject.trim(),
        body: body.trim(),
        status: 'SCHEDULED',
        scheduledAt,
        delayBetweenEmailsMs,
        hourlyLimit,
        idempotencyKey,
      },
    });

    const job = await addEmailJob(
      {
        emailId: emailRecord.id,
        userId,
        sender: normalizedSender,
        recipient,
        subject: subject.trim(),
        body: body.trim(),
        idempotencyKey,
        hourlyLimit,
        delayBetweenEmailsMs,
      },
      initialDelayMs
    );

    const updatedRecord = await prisma.emailJob.update({
      where: { id: emailRecord.id },
      data: { bullmqJobId: job.id?.toString() },
    });

    // Asynchronously index in Elasticsearch
    indexEmailRecord({
      id: updatedRecord.id,
      userId: updatedRecord.userId,
      sender: updatedRecord.sender,
      recipient: updatedRecord.recipient,
      subject: updatedRecord.subject,
      body: updatedRecord.body,
      status: updatedRecord.status,
      scheduledAt: updatedRecord.scheduledAt,
      createdAt: updatedRecord.createdAt,
    }).catch(() => {});

    scheduledJobs.push(updatedRecord);
  }

  return {
    success: true,
    totalRequested: validRecipients.length,
    scheduledCount: scheduledJobs.length,
    skippedCount: skippedDuplicates.length,
    jobs: scheduledJobs,
    skippedDuplicates,
  };
}

export async function getScheduledEmails(
  userId: string,
  page: number = 1,
  limit: number = 20,
  search?: string,
  statusFilter?: string
) {
  if (search && search.trim().length > 0) {
    return searchEmails(userId, search, statusFilter || 'scheduled_group', page, limit);
  }

  const statusList = statusFilter
    ? [statusFilter.toUpperCase()]
    : ['SCHEDULED', 'DELAYED', 'PROCESSING'];

  const whereClause = {
    userId,
    status: { in: statusList },
  };

  const [total, emails] = await Promise.all([
    prisma.emailJob.count({ where: whereClause }),
    prisma.emailJob.findMany({
      where: whereClause,
      orderBy: { scheduledAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    source: 'postgres',
    total,
    page,
    limit,
    emails,
  };
}

export async function getSentEmails(
  userId: string,
  page: number = 1,
  limit: number = 20,
  search?: string,
  statusFilter?: string
) {
  if (search && search.trim().length > 0) {
    return searchEmails(userId, search, statusFilter || 'sent_group', page, limit);
  }

  const statusList = statusFilter
    ? [statusFilter.toUpperCase()]
    : ['SENT', 'FAILED'];

  const whereClause = {
    userId,
    status: { in: statusList },
  };

  const [total, emails] = await Promise.all([
    prisma.emailJob.count({ where: whereClause }),
    prisma.emailJob.findMany({
      where: whereClause,
      orderBy: { sentAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return {
    source: 'postgres',
    total,
    page,
    limit,
    emails,
  };
}

export async function getEmailById(userId: string, id: string) {
  const email = await prisma.emailJob.findFirst({
    where: { id, userId },
  });

  if (!email) {
    throw new Error('Email job not found');
  }

  return email;
}

export async function cancelScheduledEmail(userId: string, id: string) {
  const email = await prisma.emailJob.findFirst({
    where: { id, userId },
  });

  if (!email) {
    throw new Error('Email job not found');
  }

  if (email.status === 'SENT') {
    throw new Error('Cannot cancel an email that has already been sent.');
  }

  if (email.bullmqJobId) {
    try {
      const job = await emailQueue.getJob(email.bullmqJobId);
      if (job) {
        await job.remove();
      }
    } catch (err: any) {
      console.warn(`[Queue] Could not remove BullMQ job ${email.bullmqJobId}:`, err.message);
    }
  }

  const deleted = await prisma.emailJob.delete({
    where: { id },
  });

  return { success: true, canceledEmail: deleted };
}

export async function getDashboardStats(userId: string) {
  const [totalScheduled, totalSent, totalFailed, totalDelayed] = await Promise.all([
    prisma.emailJob.count({ where: { userId, status: 'SCHEDULED' } }),
    prisma.emailJob.count({ where: { userId, status: 'SENT' } }),
    prisma.emailJob.count({ where: { userId, status: 'FAILED' } }),
    prisma.emailJob.count({ where: { userId, status: 'DELAYED' } }),
  ]);

  return {
    totalScheduled,
    totalSent,
    totalFailed,
    totalDelayed,
    totalOverall: totalScheduled + totalSent + totalFailed + totalDelayed,
  };
}
