import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://reachinbox:reachinbox_password@localhost:5432/reachinbox_scheduler?schema=public',
  REDIS_HOST: process.env.REDIS_HOST || '127.0.0.1',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || undefined,

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',

  JWT_SECRET: process.env.JWT_SECRET || 'super-secret-reachinbox-jwt-token-key-change-in-production',

  ETHEREAL_HOST: process.env.ETHEREAL_HOST || 'smtp.ethereal.email',
  ETHEREAL_PORT: parseInt(process.env.ETHEREAL_PORT || '587', 10),
  ETHEREAL_USER: process.env.ETHEREAL_USER || '',
  ETHEREAL_PASS: process.env.ETHEREAL_PASS || '',

  ELASTICSEARCH_URL: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',

  SLACK_CLIENT_ID: process.env.SLACK_CLIENT_ID || '',
  SLACK_CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET || '',
  SLACK_REDIRECT_URI: process.env.SLACK_REDIRECT_URI || 'http://localhost:5000/api/slack/callback',

  MIN_EMAIL_DELAY_MS: parseInt(process.env.MIN_EMAIL_DELAY_MS || '2000', 10),
  MAX_EMAILS_PER_HOUR_PER_SENDER: parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '100', 10),
  WORKER_CONCURRENCY: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),

  PORT: parseInt(process.env.PORT || '5000', 10),
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',

  DEV_AUTH_BYPASS: process.env.DEV_AUTH_BYPASS === 'true' || true,
};
