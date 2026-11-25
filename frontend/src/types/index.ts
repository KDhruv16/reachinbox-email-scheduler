export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  slackConnected: boolean;
  slackTeamName?: string | null;
  slackChannel?: string | null;
}

export interface EmailJob {
  id: string;
  userId: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  status: 'SCHEDULED' | 'DELAYED' | 'PROCESSING' | 'SENT' | 'FAILED';
  scheduledAt: string;
  sentAt?: string | null;
  failedAt?: string | null;
  failureReason?: string | null;
  previewUrl?: string | null;
  messageId?: string | null;
  idempotencyKey: string;
  bullmqJobId?: string | null;
  delayBetweenEmailsMs: number;
  hourlyLimit: number;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalScheduled: number;
  totalSent: number;
  totalFailed: number;
  totalDelayed: number;
  totalOverall: number;
}

export interface ScheduleEmailPayload {
  sender?: string;
  recipients: string[];
  subject: string;
  body: string;
  startTime?: string;
  delayBetweenEmails?: number;
  hourlyLimit?: number;
  batchId?: string;
}

export interface SmtpInfo {
  host: string;
  port: number;
  user: string;
  hasPass: boolean;
  webUrl: string;
}
