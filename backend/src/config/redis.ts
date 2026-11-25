import Redis from 'ioredis';
import { ENV } from './env.js';

const redisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: false,
  retryStrategy(times: number) {
    const delay = Math.min(times * 200, 2000);
    return delay;
  },
};

export const redisConnection = ENV.REDIS_URL
  ? new Redis(ENV.REDIS_URL, {
      ...redisOptions,
      tls: ENV.REDIS_URL.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
    })
  : new Redis({
      ...redisOptions,
      host: ENV.REDIS_HOST,
      port: ENV.REDIS_PORT,
      password: ENV.REDIS_PASSWORD,
    });

redisConnection.on('connect', () => {
  console.log('[Redis] Connected successfully to ' + (ENV.REDIS_URL ? 'Cloud Redis URL' : `${ENV.REDIS_HOST}:${ENV.REDIS_PORT}`));
});

redisConnection.on('error', (err) => {
  console.error('[Redis Error]', err.message);
});
