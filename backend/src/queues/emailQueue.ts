import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis.js';

export interface EmailJobPayload {
  emailId: string;
  userId: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  idempotencyKey: string;
  hourlyLimit: number;
  delayBetweenEmailsMs: number;
}

export const EMAIL_QUEUE_NAME = 'reachinbox-email-queue';

export const emailQueue = new Queue<EmailJobPayload>(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 24 * 3600, // keep completed jobs for 24 hours
      count: 1000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // keep failed jobs for 7 days
    },
  },
});

export async function addEmailJob(
  payload: EmailJobPayload,
  delayMs: number = 0,
  customJobId?: string
) {
  const jobId = customJobId || `email_${payload.emailId}`;

  const existingJob = await emailQueue.getJob(jobId);
  if (existingJob) {
    console.log(`[EmailQueue] Job ${jobId} already exists in queue. Skipping duplicate enqueue.`);
    return existingJob;
  }

  const job = await emailQueue.add('send_email', payload, {
    jobId,
    delay: Math.max(0, delayMs),
  });

  return job;
}
