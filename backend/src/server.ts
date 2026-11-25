import { app } from './app.js';
import { ENV } from './config/env.js';
import { initElasticsearch } from './config/elasticsearch.js';
import { getSenderTransporter, getEtherealCredentials, closeTransports } from './lib/mailer.js';
import { prisma } from './lib/prisma.js';
import { emailWorker, shutdownWorker } from './worker.js';

async function bootstrap() {
  console.log('--- Initializing ReachInbox Email Job Scheduler Backend ---');

  // 1. Verify Database connection
  try {
    await prisma.$connect();
    console.log('[Database] Connected to PostgreSQL successfully.');
  } catch (err: any) {
    console.error('[Database Fatal Error]', err.message);
  }

  // 2. Initialize Ethereal Mailer transporter
  try {
    await getSenderTransporter();
    const creds = getEtherealCredentials();
    console.log(`[Mailer] Nodemailer Ethereal transporter initialized (${creds?.user || 'Custom Credentials'}).`);
  } catch (err: any) {
    console.warn('[Mailer Warning]', err.message);
  }

  // 3. Initialize Elasticsearch (with graceful fallback if not yet available)
  initElasticsearch().catch((err) => {
    console.warn('[Elasticsearch Init Warning]', err.message);
  });

  // 4. Start HTTP Server
  const server = app.listen(ENV.PORT, () => {
    console.log(`[Server] API running on http://localhost:${ENV.PORT}`);
    console.log(`[Bull Board] Dashboard available at http://localhost:${ENV.PORT}/admin/queues`);
    console.log(`[Worker] Concurrency set to: ${ENV.WORKER_CONCURRENCY}`);
  });

  // Graceful shutdown
  const shutdown = async (signal = 'SIGTERM') => {
    console.log(`\n[Server] Shutting down gracefully on ${signal}...`);
    server.close();
    await shutdownWorker(signal);
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('Fatal initialization error:', err);
  process.exit(1);
});
