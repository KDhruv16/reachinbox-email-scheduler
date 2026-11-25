import { WebClient } from '@slack/web-api';
import { ENV } from '../config/env.js';

export function getSlackClient(token?: string): WebClient {
  return new WebClient(token || undefined);
}

export async function exchangeSlackCodeForToken(code: string): Promise<{
  accessToken: string;
  userId: string;
  teamName?: string;
  defaultChannelId?: string;
}> {
  const client = new WebClient();
  const response = await client.oauth.v2.access({
    client_id: ENV.SLACK_CLIENT_ID,
    client_secret: ENV.SLACK_CLIENT_SECRET,
    code,
    redirect_uri: ENV.SLACK_REDIRECT_URI,
  });

  if (!response.ok || !response.access_token) {
    throw new Error(response.error || 'Failed to exchange Slack authorization code');
  }

  return {
    accessToken: response.access_token as string,
    userId: (response.authed_user?.id as string) || (response.bot_user_id as string) || '',
    teamName: (response.team as any)?.name,
    defaultChannelId: (response.incoming_webhook as any)?.channel_id,
  };
}

export async function sendSlackNotification({
  token,
  channel,
  message,
}: {
  token: string;
  channel?: string;
  message: string;
}): Promise<boolean> {
  if (!token) {
    console.log('[Slack] No Slack token provided for notification. Skipping.');
    return false;
  }

  try {
    const client = new WebClient(token);
    let targetChannel = channel;

    if (!targetChannel) {
      try {
        const conversations = await client.conversations.list({
          types: 'public_channel,private_channel',
          limit: 20,
        });
        const channels = (conversations.channels as any[]) || [];
        const general = channels.find((c) => c.name === 'general' || c.is_general);
        if (general) {
          targetChannel = general.id;
        } else if (channels.length > 0) {
          targetChannel = channels[0].id;
        }
      } catch (err: any) {
        console.warn('[Slack] Could not list channels:', err.message);
      }
    }

    if (!targetChannel) {
      console.warn('[Slack] No channel available to send notification to.');
      return false;
    }

    await client.chat.postMessage({
      channel: targetChannel,
      text: message,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '⚠️ ReachInbox Scheduler Alert',
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: message,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Timestamp: *${new Date().toISOString()}* | System: *ReachInbox Scheduler*`,
            },
          ],
        },
      ],
    });

    console.log(`[Slack] Notification sent successfully to channel: ${targetChannel}`);
    return true;
  } catch (error: any) {
    console.error('[Slack] Failed to send notification:', error.message);
    return false;
  }
}
