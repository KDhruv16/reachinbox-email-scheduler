import Redis from 'ioredis';
import { ENV } from './env.js';

export const redisConnection = new Redis({
  host: ENV.REDIS_HOST,
  port: ENV.REDIS_PORT,
  password: ENV.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: false,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 2000);
    return delay;
  },
});

redisConnection.on('connect', () => {
  console.log('[Redis] Connected successfully to ' + ENV.REDIS_HOST + ':' + ENV.REDIS_PORT);
});

redisConnection.on('error', (err) => {
  console.error('[Redis Error]', err.message);
});
