import { redisConnection } from '../config/redis.js';
import { prisma } from '../lib/prisma.js';
import { sendSlackNotification } from '../lib/slack.js';

export interface RateLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  msUntilNextHour: number;
}

function getHourWindowKey(sender: string, date: Date = new Date()): string {
  const normalizedSender = sender.trim().toLowerCase();
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  return `rate_limit:${normalizedSender}:${yyyy}${mm}${dd}${hh}`;
}

export function getMsUntilNextHour(now: Date = new Date()): number {
  const nextHour = new Date(now);
  nextHour.setUTCMinutes(0, 0, 0);
  nextHour.setUTCHours(nextHour.getUTCHours() + 1);
  return Math.max(1000, nextHour.getTime() - now.getTime() + 2000); // 2 second buffer
}

export async function checkAndIncrementHourlyLimit(
  sender: string,
  limit: number
): Promise<RateLimitCheckResult> {
  const now = new Date();
  const normalizedSender = sender.trim().toLowerCase();
  const key = getHourWindowKey(normalizedSender, now);
  const msUntilNextHour = getMsUntilNextHour(now);
  const expireSeconds = Math.ceil(msUntilNextHour / 1000) + 3600;

  // Atomic Lua script to check limit and increment counter
  const luaScript = `
    local current = redis.call('GET', KEYS[1])
    if current and tonumber(current) >= tonumber(ARGV[1]) then
      return {0, tonumber(current)}
    end
    local newVal = redis.call('INCR', KEYS[1])
    if newVal == 1 then
      redis.call('EXPIRE', KEYS[1], ARGV[2])
    end
    return {1, newVal}
  `;

  const [allowedFlag, count] = (await redisConnection.eval(
    luaScript,
    1,
    key,
    limit,
    expireSeconds
  )) as [number, number];

  const allowed = allowedFlag === 1;

  return {
    allowed,
    currentCount: count,
    limit,
    msUntilNextHour,
  };
}

/**
 * Atomically reserves a dedicated execution timestamp slot for a sender,
 * guaranteeing that no two workers dispatch within minDelayMs of each other.
 */
export async function reserveSenderSpacingSlot(
  sender: string,
  minDelayMs: number
): Promise<{ slot: number; waitMs: number }> {
  if (minDelayMs <= 0) {
    return { slot: Date.now(), waitMs: 0 };
  }

  const normalizedSender = sender.trim().toLowerCase();
  const spacingKey = `rate_spacing:${normalizedSender}`;
  const now = Date.now();

  const luaScript = `
    local now = tonumber(ARGV[1])
    local gap = tonumber(ARGV[2])
    local nextAvailable = tonumber(redis.call('GET', KEYS[1]) or '0')
    local slot = now
    if nextAvailable > slot then
      slot = nextAvailable
    end
    local ttlMs = (slot + gap - now) + 60000
    redis.call('SET', KEYS[1], slot + gap, 'PX', ttlMs)
    return slot
  `;

  const slot = (await redisConnection.eval(
    luaScript,
    1,
    spacingKey,
    now,
    minDelayMs
  )) as number;

  const waitMs = Math.max(0, slot - Date.now());
  return { slot, waitMs };
}

export async function triggerSlackRateLimitAlertIfNeeded(
  userId: string,
  sender: string,
  limit: number
): Promise<void> {
  const now = new Date();
  const normalizedSender = sender.trim().toLowerCase();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const alertDedupeKey = `slack_alert_dedupe:${normalizedSender}:${yyyy}${mm}${dd}${hh}`;

  const acquired = await redisConnection.set(alertDedupeKey, '1', 'EX', 3600, 'NX');
  if (acquired !== 'OK') {
    return; // Already notified in this hour window
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { slackAccessToken: true, slackChannel: true },
    });

    if (user && user.slackAccessToken) {
      const msg = `Sender *${normalizedSender}* has reached the hourly limit of *${limit} emails*. Remaining scheduled emails are automatically rescheduled to the next available hour window to protect your domain reputation.`;
      await sendSlackNotification({
        token: user.slackAccessToken,
        channel: user.slackChannel || undefined,
        message: msg,
      });
    }
  } catch (err: any) {
    console.warn('[RateLimiter] Could not send Slack rate limit alert:', err.message);
  }
}
