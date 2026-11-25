import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { ENV } from './config/env.js';
import { authRouter } from './routes/authRoutes.js';
import { emailRouter } from './routes/emailRoutes.js';
import { slackRouter } from './routes/slackRoutes.js';
import { healthRouter } from './routes/healthRoutes.js';
import { bullBoardRouter } from './queues/bullBoard.js';
import { errorHandler } from './middleware/errorHandler.js';

export const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow any origin dynamically to support any deployed domain (Vercel, Render, local)
      callback(null, true);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Bull Board Queue Dashboard (Protected or accessible for monitoring)
app.use('/admin/queues', bullBoardRouter);

// API Endpoints
app.use('/api/auth', authRouter);
app.use('/api/emails', emailRouter);
app.use('/api/slack', slackRouter);
app.use('/api', healthRouter);

// Central error handler
app.use(errorHandler);
