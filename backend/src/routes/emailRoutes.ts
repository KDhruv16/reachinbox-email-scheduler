import { Router } from 'express';
import { AuthRequest, requireAuth } from '../middleware/auth.js';
import {
  scheduleEmails,
  getScheduledEmails,
  getSentEmails,
  getEmailById,
  cancelScheduledEmail,
  getDashboardStats,
} from '../services/emailService.js';
import { searchEmails, reindexAllEmails } from '../services/elasticsearchService.js';
import { getEtherealCredentials } from '../lib/mailer.js';

export const emailRouter = Router();

// POST /api/emails/schedule
emailRouter.post('/schedule', requireAuth, async (req: AuthRequest, res) => {
  try {
    const {
      subject,
      body,
      recipients,
      startTime,
      delayBetweenEmails,
      hourlyLimit,
      sender,
      batchId,
    } = req.body;

    const result = await scheduleEmails({
      userId: req.user!.id,
      sender: sender || req.user!.email,
      recipients,
      subject,
      body,
      startTime,
      delayBetweenEmailsMs: delayBetweenEmails ? parseInt(delayBetweenEmails, 10) : undefined,
      hourlyLimit: hourlyLimit ? parseInt(hourlyLimit, 10) : undefined,
      batchId,
    });

    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/emails/scheduled
emailRouter.get('/scheduled', requireAuth, async (req: AuthRequest, res) => {
  try {
    const page = parseInt((req.query.page as string) || '1', 10);
    const limit = parseInt((req.query.limit as string) || '20', 10);
    const search = req.query.search as string;
    const status = req.query.status as string;

    const data = await getScheduledEmails(req.user!.id, page, limit, search, status);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/emails/sent
emailRouter.get('/sent', requireAuth, async (req: AuthRequest, res) => {
  try {
    const page = parseInt((req.query.page as string) || '1', 10);
    const limit = parseInt((req.query.limit as string) || '20', 10);
    const search = req.query.search as string;
    const status = req.query.status as string;

    const data = await getSentEmails(req.user!.id, page, limit, search, status);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/emails/search
emailRouter.get('/search', requireAuth, async (req: AuthRequest, res) => {
  try {
    const query = (req.query.q as string) || '';
    const status = req.query.status as string;
    const page = parseInt((req.query.page as string) || '1', 10);
    const limit = parseInt((req.query.limit as string) || '20', 10);

    const data = await searchEmails(req.user!.id, query, status, page, limit);
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/emails/stats
emailRouter.get('/stats', requireAuth, async (req: AuthRequest, res) => {
  try {
    const stats = await getDashboardStats(req.user!.id);
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/emails/smtp-info
emailRouter.get('/smtp-info', requireAuth, (req: AuthRequest, res) => {
  const creds = getEtherealCredentials();
  res.json({
    smtp: {
      host: creds?.host || 'smtp.ethereal.email',
      port: creds?.port || 587,
      user: creds?.user || 'Auto-generated',
      hasPass: !!creds?.pass,
      webUrl: 'https://ethereal.email/messages',
    },
  });
});

// POST /api/emails/reindex
emailRouter.post('/reindex', requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await reindexAllEmails();
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/emails/:id
emailRouter.get('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const email = await getEmailById(req.user!.id, req.params.id);
    res.json(email);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

// DELETE /api/emails/:id
emailRouter.delete('/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const result = await cancelScheduledEmail(req.user!.id, req.params.id);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});
