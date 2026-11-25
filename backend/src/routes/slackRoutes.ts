import { Router } from 'express';
import { AuthRequest, requireAuth } from '../middleware/auth.js';
import { ENV } from '../config/env.js';
import { exchangeSlackCodeForToken, sendSlackNotification } from '../lib/slack.js';
import { prisma } from '../lib/prisma.js';

export const slackRouter = Router();

// GET /api/slack/connect
slackRouter.get('/connect', requireAuth, (req: AuthRequest, res) => {
  if (!ENV.SLACK_CLIENT_ID || !ENV.SLACK_CLIENT_SECRET) {
    return res.redirect(
      `${ENV.FRONTEND_URL}/integrations?error=Slack+OAuth+credentials+not+configured+in+backend+.env.`
    );
  }

  const rootUrl = 'https://slack.com/oauth/v2/authorize';
  const options = {
    client_id: ENV.SLACK_CLIENT_ID,
    scope: 'chat:write,channels:read,incoming-webhook',
    redirect_uri: ENV.SLACK_REDIRECT_URI,
    state: req.user!.id,
  };

  const qs = new URLSearchParams(options);
  res.redirect(`${rootUrl}?${qs.toString()}`);
});

// GET /api/slack/callback
slackRouter.get('/callback', async (req, res) => {
  const code = req.query.code as string;
  const stateUserId = req.query.state as string;

  if (!code) {
    return res.redirect(`${ENV.FRONTEND_URL}/integrations?error=Missing+Slack+code`);
  }

  try {
    const tokenData = await exchangeSlackCodeForToken(code);

    let targetUserId = stateUserId;
    if (!targetUserId) {
      const firstUser = await prisma.user.findFirst();
      targetUserId = firstUser ? firstUser.id : '';
    }

    if (targetUserId) {
      await prisma.user.update({
        where: { id: targetUserId },
        data: {
          slackAccessToken: tokenData.accessToken,
          slackUserId: tokenData.userId,
          slackTeamName: tokenData.teamName,
          slackChannel: tokenData.defaultChannelId,
        },
      });

      // Send welcome / test notification
      await sendSlackNotification({
        token: tokenData.accessToken,
        channel: tokenData.defaultChannelId,
        message: `Slack integration connected successfully for ReachInbox Email Scheduler! You will receive hourly rate limit alerts here.`,
      });
    }

    res.redirect(`${ENV.FRONTEND_URL}/integrations?slack=connected`);
  } catch (err: any) {
    console.error('[Slack OAuth Error]', err.message);
    res.redirect(`${ENV.FRONTEND_URL}/integrations?error=${encodeURIComponent(err.message)}`);
  }
});

// POST /api/slack/disconnect
slackRouter.post('/disconnect', requireAuth, async (req: AuthRequest, res) => {
  try {
    await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        slackAccessToken: null,
        slackUserId: null,
        slackChannel: null,
        slackTeamName: null,
      },
    });

    res.json({ success: true, message: 'Slack disconnected successfully' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to disconnect Slack', details: err.message });
  }
});
