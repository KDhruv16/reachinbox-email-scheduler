import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { prisma } from '../lib/prisma.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
  slackAccessToken?: string | null;
  slackTeamName?: string | null;
  slackChannel?: string | null;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export async function getOrCreateDevUser(): Promise<AuthenticatedUser> {
  const devEmail = 'demo@reachinbox.ai';
  let user = await prisma.user.findUnique({
    where: { email: devEmail },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: devEmail,
        name: 'ReachInbox Demo User',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
      },
    });
  }

  return user;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    let token = req.cookies?.reachinbox_token;

    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const decoded = jwt.verify(token, ENV.JWT_SECRET) as { userId: string; email: string };
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user) {
        return res.status(401).json({ error: 'User no longer exists' });
      }

      req.user = user;
      next();
    } catch (jwtErr) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  } catch (err: any) {
    return res.status(500).json({ error: 'Authentication failed', details: err.message });
  }
}
