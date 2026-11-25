import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { ENV } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { AuthRequest, requireAuth, getOrCreateDevUser } from '../middleware/auth.js';

export const authRouter = Router();

function generateAuthToken(userId: string, email: string): string {
  return jwt.sign({ userId, email }, ENV.JWT_SECRET, { expiresIn: '7d' });
}

function setAuthCookie(res: Response, token: string) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('reachinbox_token', token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

// GET /api/auth/me
authRouter.get('/me', requireAuth, (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  res.json({
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      avatar: req.user.avatar,
      slackConnected: !!req.user.slackAccessToken,
      slackTeamName: req.user.slackTeamName,
      slackChannel: req.user.slackChannel,
    },
  });
});

// GET /api/auth/google
authRouter.get('/google', (req: Request, res: Response) => {
  if (!ENV.GOOGLE_CLIENT_ID || !ENV.GOOGLE_CLIENT_SECRET) {
    return res.redirect(
      `${ENV.FRONTEND_URL}/login?error=Google+OAuth+credentials+not+configured+in+backend+.env.+Use+Dev+Login+for+local+testing.`
    );
  }

  const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  const options = {
    redirect_uri: ENV.GOOGLE_CALLBACK_URL,
    client_id: ENV.GOOGLE_CLIENT_ID,
    access_type: 'offline',
    response_type: 'code',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' '),
  };

  const qs = new URLSearchParams(options);
  res.redirect(`${rootUrl}?${qs.toString()}`);
});

// GET /api/auth/google/callback
authRouter.get('/google/callback', async (req: Request, res: Response) => {
  const code = req.query.code as string;

  if (!code) {
    return res.redirect(`${ENV.FRONTEND_URL}/login?error=Missing+authorization+code`);
  }

  try {
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: ENV.GOOGLE_CLIENT_ID,
      client_secret: ENV.GOOGLE_CLIENT_SECRET,
      redirect_uri: ENV.GOOGLE_CALLBACK_URL,
      grant_type: 'authorization_code',
    });

    const { access_token, id_token } = tokenResponse.data;

    const profileResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const { id: googleId, email, name, picture } = profileResponse.data;

    let user = await prisma.user.findFirst({
      where: {
        OR: [{ googleId }, { email }],
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: name || 'ReachInbox User',
          avatar: picture,
          googleId,
        },
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId,
          avatar: picture || user.avatar,
          name: name || user.name,
        },
      });
    }

    const token = generateAuthToken(user.id, user.email);
    setAuthCookie(res, token);

    res.redirect(`${ENV.FRONTEND_URL}/dashboard`);
  } catch (err: any) {
    console.error('[Google OAuth Error]', err.response?.data || err.message);
    res.redirect(
      `${ENV.FRONTEND_URL}/login?error=${encodeURIComponent(
        err.response?.data?.error_description || 'Failed to authenticate with Google'
      )}`
    );
  }
});

// POST /api/auth/dev-login (Local dev evaluation helper)
authRouter.post('/dev-login', async (req: Request, res: Response) => {
  try {
    const devUser = await getOrCreateDevUser();
    const token = generateAuthToken(devUser.id, devUser.email);
    setAuthCookie(res, token);

    res.json({
      success: true,
      token,
      user: {
        id: devUser.id,
        name: devUser.name,
        email: devUser.email,
        avatar: devUser.avatar,
        slackConnected: !!devUser.slackAccessToken,
        slackTeamName: devUser.slackTeamName,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Dev login failed', details: err.message });
  }
});

// POST /api/auth/logout
authRouter.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('reachinbox_token');
  res.json({ success: true, message: 'Logged out successfully' });
});
