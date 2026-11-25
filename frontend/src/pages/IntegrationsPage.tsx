import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { slackApi, emailApi, API_BASE } from '../api/client';
import { SmtpInfo } from '../types';
import {
  MessageSquare,
  Database,
  Mail,
  ExternalLink,
  CheckCircle2,
  RotateCw,
} from 'lucide-react';

export const IntegrationsPage: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [smtpInfo, setSmtpInfo] = useState<SmtpInfo | null>(null);
  const [reindexing, setReindexing] = useState(false);
  const [reindexResult, setReindexResult] = useState<string | null>(null);

  useEffect(() => {
    emailApi.getSmtpInfo().then((res) => setSmtpInfo(res.smtp)).catch(() => {});
  }, []);

  const handleConnectSlack = () => {
    window.location.href = `${API_BASE}/api/slack/connect`;
  };

  const handleDisconnectSlack = async () => {
    try {
      await slackApi.disconnect();
      await refreshUser();
    } catch (err: any) {
      alert('Failed to disconnect Slack: ' + err.message);
    }
  };

  const handleReindex = async () => {
    setReindexing(true);
    setReindexResult(null);
    try {
      const res = await emailApi.reindex();
      setReindexResult(`Successfully synchronized ${res.totalReindexed} emails into Elasticsearch.`);
    } catch (err: any) {
      setReindexResult('Elasticsearch reindexing failed: ' + err.message);
    } finally {
      setReindexing(false);
    }
  };

  return (
    <div className="flex h-full flex-col space-y-4 overflow-y-auto pr-1">
      {/* Header */}
      <div className="pb-3 border-b border-line">
        <h1 className="text-lg font-semibold text-ink">Integrations & External Services</h1>
        <p className="text-xs text-muted">
          Manage OAuth connections, Ethereal SMTP mailboxes, and Elasticsearch indexing
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Slack Webhook Card */}
        <div className="p-5 bg-field rounded-xl border border-line flex flex-col justify-between space-y-4">
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-xl bg-white border border-line flex items-center justify-center shrink-0">
              <MessageSquare className="size-5 text-[#E01E5A]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-ink">Slack Notifications</h3>
                {user?.slackConnected ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Connected
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-field text-muted border border-line">
                    Not connected
                  </span>
                )}
              </div>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Sends automated Slack Web API notifications when a sender reaches their hourly rate limit.
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-line/60 flex items-center justify-between">
            {user?.slackConnected ? (
              <button
                onClick={handleDisconnectSlack}
                className="px-4 py-1.5 rounded-full border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-medium transition"
              >
                Disconnect Slack
              </button>
            ) : (
              <button
                onClick={handleConnectSlack}
                className="px-4 py-1.5 rounded-full border border-brand bg-white text-brand hover:bg-brand-soft text-xs font-medium transition"
              >
                Connect Slack Workspace
              </button>
            )}
          </div>
        </div>

        {/* Ethereal SMTP Mailbox Card */}
        <div className="p-5 bg-field rounded-xl border border-line flex flex-col justify-between space-y-4">
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-xl bg-white border border-line flex items-center justify-center shrink-0">
              <Mail className="size-5 text-brand" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-ink">Ethereal SMTP Sandbox</h3>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Real outbound SMTP test mailbox. Transporter socket verified on host port 587.
              </p>
              {smtpInfo && (
                <div className="mt-2 text-[11px] font-mono text-ink bg-white p-2 rounded-lg border border-line truncate">
                  User: {smtpInfo.user}
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-line/60 flex items-center justify-between">
            <a
              href="https://ethereal.email/messages"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-brand hover:underline font-medium"
            >
              <span>Open Ethereal Mailbox</span>
              <ExternalLink className="size-3" />
            </a>
          </div>
        </div>

        {/* Elasticsearch Sync Card */}
        <div className="p-5 bg-field rounded-xl border border-line flex flex-col justify-between space-y-4 md:col-span-2">
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-xl bg-white border border-line flex items-center justify-center shrink-0">
              <Database className="size-5 text-brand" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink">Elasticsearch Full-Text Indexing</h3>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Powers real-time fuzzy queries across recipients, subjects, and email bodies with transparent PostgreSQL ILIKE fallback.
              </p>
              {reindexResult && (
                <p className="mt-2 text-xs text-brand font-medium flex items-center gap-1">
                  <CheckCircle2 className="size-3.5" />
                  <span>{reindexResult}</span>
                </p>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-line/60 flex items-center justify-end">
            <button
              onClick={handleReindex}
              disabled={reindexing}
              className="inline-flex items-center gap-1.5 px-4 h-9 rounded-full border border-brand bg-white text-xs font-medium text-brand hover:bg-brand-soft transition disabled:opacity-50"
            >
              <RotateCw className={`size-3.5 ${reindexing ? 'animate-spin' : ''}`} />
              <span>{reindexing ? 'Reindexing...' : 'Reindex All PostgreSQL Records'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
