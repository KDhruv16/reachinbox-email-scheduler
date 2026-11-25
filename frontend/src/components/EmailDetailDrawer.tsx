import React, { useState } from 'react';
import { EmailJob } from '../types';
import {
  X,
  ExternalLink,
  RotateCw,
  Copy,
  Check,
  Mail,
  Eye,
  Code,
  XCircle,
  Clock,
} from 'lucide-react';
import { emailApi } from '../api/client';

interface EmailDetailDrawerProps {
  email: EmailJob | null;
  isOpen: boolean;
  onClose: () => void;
  onEmailCancelled?: () => void;
}

export const EmailDetailDrawer: React.FC<EmailDetailDrawerProps> = ({
  email,
  isOpen,
  onClose,
  onEmailCancelled,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [canceling, setCanceling] = useState(false);

  if (!isOpen || !email) return null;

  const handleCopy = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCancelEmail = async () => {
    if (!confirm('Are you sure you want to cancel and remove this scheduled email?')) return;
    setCanceling(true);
    try {
      await emailApi.cancel(email.id);
      onEmailCancelled?.();
      onClose();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || 'Failed to cancel email');
    } finally {
      setCanceling(false);
    }
  };

  const renderStatusBadge = (status: EmailJob['status']) => {
    const base = 'inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium';
    switch (status) {
      case 'SENT':
        return (
          <span className={`${base} border-line bg-field text-[#555]`}>
            <span>Sent</span>
          </span>
        );
      case 'SCHEDULED':
        return (
          <span className={`${base} border-warn-line bg-warn-bg text-warn-ink`}>
            <Clock className="size-3" />
            <span>Scheduled</span>
          </span>
        );
      case 'DELAYED':
        return (
          <span className={`${base} border-amber-300 bg-amber-50 text-amber-800`}>
            <Clock className="size-3" />
            <span>Rescheduled (Rate-Limited)</span>
          </span>
        );
      case 'PROCESSING':
        return (
          <span className={`${base} border-warn-line bg-warn-bg text-warn-ink`}>
            <RotateCw className="size-3 animate-spin" />
            <span>Sending now...</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className={`${base} border-red-200 bg-red-50 text-red-600`}>
            <span>Failed</span>
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/30 backdrop-blur-xs flex justify-end">
      <div className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col border-l border-line animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-5 border-b border-line flex items-center justify-between bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-9 rounded-full bg-field text-ink flex items-center justify-center shrink-0">
              <Mail className="size-4 text-muted" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-ink truncate">
                {email.subject}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                {renderStatusBadge(email.status)}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted hover:text-ink hover:bg-field rounded-full transition"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Metadata Card */}
          <div className="bg-field rounded-xl border border-line p-4 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted">Recipient:</span>
              <span className="font-medium text-ink">{email.recipient}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted">Sender:</span>
              <span className="font-medium text-ink">{email.sender}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted">Scheduled Time:</span>
              <span className="font-mono text-ink">
                {new Date(email.scheduledAt).toLocaleString()}
              </span>
            </div>

            {email.sentAt && (
              <div className="flex items-center justify-between">
                <span className="text-muted">Delivered At:</span>
                <span className="font-mono text-brand font-medium">
                  {new Date(email.sentAt).toLocaleString()}
                </span>
              </div>
            )}

            {email.messageId && (
              <div className="flex items-center justify-between pt-2 border-t border-line">
                <span className="text-muted">SMTP Message ID:</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[11px] text-ink bg-white px-2 py-0.5 rounded border border-line max-w-[200px] truncate">
                    {email.messageId}
                  </span>
                  <button
                    onClick={() => handleCopy(email.messageId!, 'messageId')}
                    className="p-1 text-muted hover:text-ink transition"
                    title="Copy Message ID"
                  >
                    {copiedKey === 'messageId' ? (
                      <Check className="size-3 text-brand" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-muted">Idempotency Key:</span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[11px] text-muted bg-white px-2 py-0.5 rounded border border-line max-w-[200px] truncate">
                  {email.idempotencyKey}
                </span>
                <button
                  onClick={() => handleCopy(email.idempotencyKey, 'idempotency')}
                  className="p-1 text-muted hover:text-ink transition"
                  title="Copy Key"
                >
                  {copiedKey === 'idempotency' ? (
                    <Check className="size-3 text-brand" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Ethereal Web Preview Banner */}
          {email.previewUrl && (
            <div className="p-3.5 bg-brand-soft rounded-xl border border-[#cce9d4] flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-ink">Ethereal Live Preview</div>
                <div className="text-[11px] text-muted mt-0.5">
                  Inspect the email in the sandbox browser
                </div>
              </div>
              <a
                href={email.previewUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-brand text-brand hover:bg-[#d6eedd] rounded-full text-xs font-medium transition"
              >
                <span>View on Ethereal</span>
                <ExternalLink className="size-3" />
              </a>
            </div>
          )}

          {/* Message Content Tabs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-ink">Email Body</span>
              <div className="flex items-center bg-field p-0.5 rounded-lg text-xs">
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                    activeTab === 'preview' ? 'bg-white text-ink shadow-2xs font-semibold' : 'text-muted'
                  }`}
                >
                  <Eye className="size-3" />
                  <span>Preview</span>
                </button>
                <button
                  onClick={() => setActiveTab('code')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                    activeTab === 'code' ? 'bg-white text-ink shadow-2xs font-semibold' : 'text-muted'
                  }`}
                >
                  <Code className="size-3" />
                  <span>Raw HTML</span>
                </button>
              </div>
            </div>

            {activeTab === 'preview' ? (
              <div
                className="p-4 border border-line rounded-xl min-h-[160px] text-xs text-ink bg-white prose-email overflow-auto"
                dangerouslySetInnerHTML={{ __html: email.body }}
              />
            ) : (
              <pre className="p-4 border border-line rounded-xl min-h-[160px] text-xs font-mono bg-field text-ink overflow-x-auto whitespace-pre-wrap">
                {email.body}
              </pre>
            )}
          </div>
        </div>

        {/* Drawer Footer Actions */}
        <div className="p-4 border-t border-line flex items-center justify-between bg-white">
          {(email.status === 'SCHEDULED' || email.status === 'DELAYED') ? (
            <button
              onClick={handleCancelEmail}
              disabled={canceling}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition disabled:opacity-50"
            >
              <XCircle className="size-3.5" />
              <span>{canceling ? 'Cancelling...' : 'Cancel Scheduled Email'}</span>
            </button>
          ) : (
            <span className="text-xs text-muted">Execution completed</span>
          )}

          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium bg-field hover:bg-[#ececec] text-ink rounded-full transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
