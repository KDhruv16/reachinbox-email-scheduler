import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { ENV } from '../config/env.js';

const CREDENTIALS_FILE = path.resolve(process.cwd(), '.ethereal-account.json');

// Reusable connection pools per sender key
const transportPool = new Map<string, nodemailer.Transporter>();
let defaultEtherealCredentials: { user: string; pass: string; host: string; port: number } | null = null;

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure?: boolean;
}

export async function getDefaultEtherealCredentials() {
  if (defaultEtherealCredentials) {
    return defaultEtherealCredentials;
  }

  let user = ENV.ETHEREAL_USER;
  let pass = ENV.ETHEREAL_PASS;
  let host = ENV.ETHEREAL_HOST || 'smtp.ethereal.email';
  let port = ENV.ETHEREAL_PORT || 587;

  // Auto-detect Gmail credentials if user passed a gmail address
  if (user && user.endsWith('@gmail.com') && (host === 'smtp.ethereal.email' || host === 'smtp.gmail.com')) {
    host = 'smtp.gmail.com';
    port = 465;
    console.log(`[Mailer] Detected Gmail account [${user}]. Configured for smtp.gmail.com:465`);
  }

  // 1. Try reading saved persistent credentials if env is empty
  if (!user || !pass) {
    if (fs.existsSync(CREDENTIALS_FILE)) {
      try {
        const saved = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf-8'));
        if (saved.user && saved.pass) {
          user = saved.user;
          pass = saved.pass;
          defaultEtherealCredentials = { user, pass, host, port };
          console.log(`[Mailer] Loaded persistent Ethereal account: ${user}`);
        }
      } catch (err: any) {
        console.warn('[Mailer] Could not read saved ethereal credentials:', err.message);
      }
    }
  }

  // 2. Generate new test account if still missing, and persist to file
  if (!user || !pass) {
    try {
      console.log('[Mailer] Creating new test Ethereal SMTP account...');
      const testAccount = await nodemailer.createTestAccount();
      user = testAccount.user;
      pass = testAccount.pass;
      defaultEtherealCredentials = { user, pass, host, port };

      try {
        fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify({ user, pass, host, port }, null, 2), 'utf-8');
        console.log(`[Mailer] Successfully generated and saved Ethereal account: ${user}`);
      } catch (writeErr: any) {
        console.warn('[Mailer] Failed to save ethereal credentials file:', writeErr.message);
      }
    } catch (err: any) {
      console.error('[Mailer Fatal] Failed to create test Ethereal account:', err.message);
      throw err;
    }
  } else if (!defaultEtherealCredentials) {
    defaultEtherealCredentials = { user, pass, host, port };
  }

  return defaultEtherealCredentials;
}

/**
 * Returns a pooled Transporter for a specific sender identity.
 * Reuses active sockets across concurrent worker jobs (pool: true, maxConnections: 5).
 */
export async function getSenderTransporter(senderKey = 'default', customConfig?: SmtpConfig): Promise<nodemailer.Transporter> {
  const normalizedKey = senderKey.trim().toLowerCase();
  const existing = transportPool.get(normalizedKey);
  if (existing) {
    return existing;
  }

  let host: string;
  let port: number;
  let user: string;
  let pass: string;
  let secure: boolean;

  if (customConfig && customConfig.user && customConfig.pass) {
    host = customConfig.host;
    port = customConfig.port;
    user = customConfig.user;
    pass = customConfig.pass;
    secure = customConfig.secure ?? port === 465;
  } else {
    const creds = await getDefaultEtherealCredentials();
    host = creds.host;
    port = creds.port;
    user = creds.user;
    pass = creds.pass;
    secure = port === 465;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });

  try {
    await transporter.verify();
    console.log(`[Mailer] Verified pooled SMTP transporter for [${normalizedKey}] (${host}:${port}) as ${user}`);
  } catch (verifyErr: any) {
    console.error(`[Mailer Warning] SMTP verification failed for [${normalizedKey}]:`, verifyErr.message);
  }

  transportPool.set(normalizedKey, transporter);
  return transporter;
}

export async function sendEmail({
  emailId,
  from,
  to,
  subject,
  html,
  customConfig,
}: {
  emailId?: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  customConfig?: SmtpConfig;
}): Promise<{ messageId: string; previewUrl: string | null }> {
  const senderAddress = from.trim().toLowerCase();
  const transporter = await getSenderTransporter(senderAddress, customConfig);

  const formattedFrom = senderAddress.includes('<')
    ? senderAddress
    : `"ReachInbox Outreach" <${senderAddress}>`;

  // Generate plain text fallback for better deliverability
  const textContent = html.replace(/<[^>]*>?/gm, '').trim();

  console.log(`[Mailer] Dispatching to ${to} from ${formattedFrom} (Subject: "${subject}")`);

  const info = await transporter.sendMail({
    from: formattedFrom,
    to: to.trim().toLowerCase(),
    subject,
    html,
    text: textContent || subject,
    // Stable RFC Message-ID to ensure traceability downstream
    messageId: emailId ? `<${emailId}@reachinbox.local>` : undefined,
  });

  if (!info || !info.messageId) {
    throw new Error('SMTP delivery completed without a valid messageId.');
  }

  const previewUrl = nodemailer.getTestMessageUrl(info);
  const previewStr = typeof previewUrl === 'string' ? previewUrl : null;

  console.log(
    `[Mailer] Delivered! MessageID: ${info.messageId} | Preview: ${previewStr || 'N/A'}`
  );

  return {
    messageId: info.messageId,
    previewUrl: previewStr,
  };
}

/**
 * Closes all active pooled socket connections gracefully.
 */
export function closeTransports() {
  console.log(`[Mailer] Closing ${transportPool.size} active SMTP connection pools...`);
  for (const [key, t] of transportPool.entries()) {
    try {
      t.close();
    } catch (e: any) {
      console.warn(`[Mailer] Error closing transport ${key}:`, e.message);
    }
  }
  transportPool.clear();
}

export function getEtherealCredentials() {
  return defaultEtherealCredentials;
}
