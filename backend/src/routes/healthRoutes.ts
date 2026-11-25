import { Router, Request, Response } from 'express';
import { redisConnection } from '../config/redis.js';
import { prisma } from '../lib/prisma.js';
import { isElasticsearchReady } from '../config/elasticsearch.js';

export const healthRouter = Router();

// GET /api/health
healthRouter.get('/health', async (req: Request, res: Response) => {
  const health: {
    status: string;
    timestamp: string;
    services: {
      database: string;
      redis: string;
      elasticsearch: string;
    };
  } = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: 'unknown',
      redis: 'unknown',
      elasticsearch: isElasticsearchReady() ? 'connected' : 'disconnected (fallback active)',
    },
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    health.services.database = 'connected';
  } catch (err: any) {
    health.services.database = `error: ${err.message}`;
    health.status = 'degraded';
  }

  try {
    const ping = await redisConnection.ping();
    health.services.redis = ping === 'PONG' ? 'connected' : 'unexpected response';
  } catch (err: any) {
    health.services.redis = `error: ${err.message}`;
    health.status = 'degraded';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});
