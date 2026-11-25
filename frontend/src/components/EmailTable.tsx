import React, { useState } from 'react';
import { EmailJob } from '../types';
import {
  Clock,
  Star,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { EmailDetailDrawer } from './EmailDetailDrawer';

interface EmailTableProps {
  emails: EmailJob[];
  loading?: boolean;
  total?: number;
  page?: number;
  limit?: number;
  onPageChange?: (newPage: number) => void;
  onRefresh?: () => void;
}

function formatBadgeTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return dateStr;
  }
}

function formatShortDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export const EmailTable: React.FC<EmailTableProps> = ({
  emails,
  loading = false,
  total = emails.length,
  page = 1,
  limit = 20,
  onPageChange,
  onRefresh,
}) => {
  const [selectedEmail, setSelectedEmail] = useState<EmailJob | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [starred, setStarred] = useState<Record<string, boolean>>({});

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const handleRowClick = (email: EmailJob) => {
    setSelectedEmail(email);
    setIsDrawerOpen(true);
  };

  const toggleStar = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setStarred((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const renderStatusBadge = (email: EmailJob) => {
    const base = 'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap';

    switch (email.status) {
      case 'SCHEDULED':
        return (
          <span className={`${base} border-warn-line bg-warn-bg text-warn-ink`}>
            <Clock className="size-3" />
            <span>{formatBadgeTime(email.scheduledAt)}</span>
          </span>
        );
      case 'DELAYED':
        return (
          <span className={`${base} border-amber-300 bg-amber-50 text-amber-800`}>
            <Clock className="size-3" />
            <span>Rescheduled</span>
          </span>
        );
      case 'PROCESSING':
        return (
          <span className={`${base} border-warn-line bg-warn-bg text-warn-ink`}>
            <Clock className="size-3 animate-pulse" />
            <span>Sending</span>
          </span>
        );
      case 'SENT':
        return (
          <span className={`${base} border-line bg-field text-[#555]`}>
            <span>Sent</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className={`${base} border-red-200 bg-red-50 text-red-600`}>
            <span>Failed</span>
          </span>
        );
      default:
        return (
          <span className={`${base} border-line bg-field text-[#555]`}>
            <span>{email.status}</span>
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col border-t border-line">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex animate-pulse items-center gap-4 border-b border-line px-5 py-4">
            <span className="h-3.5 w-36 rounded bg-field" />
            <span className="h-5 w-20 rounded-full bg-field" />
            <span className="h-3.5 flex-1 rounded bg-field" />
            <span className="h-3.5 w-14 rounded bg-field" />
          </div>
        ))}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm font-medium text-ink">No emails found</p>
        <p className="text-xs text-muted mt-1">Scheduled and sent emails will appear in this list.</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col">
      {/* Figma Email Rows List */}
      <div className="flex flex-col border-t border-line">
        {emails.map((email) => {
          const bodySnippet = email.body ? email.body.replace(/<[^>]*>?/gm, '').trim() : '';
          const timingDate = email.sentAt || email.failedAt || email.scheduledAt;
          const isStarred = starred[email.id];

          return (
            <div
              key={email.id}
              onClick={() => handleRowClick(email)}
              className="group flex items-center gap-4 border-b border-line px-4 sm:px-5 py-3 text-sm transition-colors hover:bg-[#fafafa] cursor-pointer select-none"
            >
              {/* Recipient */}
              <span className="w-36 sm:w-44 shrink-0 truncate text-ink font-normal" title={email.recipient}>
                To: {email.recipient}
              </span>

              {/* Status Badge + Subject & Snippet */}
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {renderStatusBadge(email)}
                <span className="truncate min-w-0">
                  <span className="font-medium text-ink">{email.subject}</span>
                  {bodySnippet && (
                    <span className="text-muted font-normal"> - {bodySnippet}</span>
                  )}
                </span>
              </div>

              {/* Timestamp */}
              <time className="shrink-0 text-xs text-muted" title={email.scheduledAt}>
                {formatShortDate(timingDate)}
              </time>

              {/* Star Icon */}
              <button
                type="button"
                onClick={(e) => toggleStar(e, email.id)}
                className="p-1 text-[#c4c4c4] hover:text-amber-400 transition"
              >
                <Star
                  className={`size-4 shrink-0 ${
                    isStarred ? 'fill-amber-400 text-amber-400' : 'text-[#c4c4c4]'
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 text-xs text-muted border-t border-line">
          <span>
            Showing {(page - 1) * limit + 1}–{Math.min(total, page * limit)} of {total} emails
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange && onPageChange(page - 1)}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-line text-ink disabled:opacity-30 disabled:pointer-events-none hover:bg-field transition"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="px-2 font-medium text-ink">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => onPageChange && onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-line text-ink disabled:opacity-30 disabled:pointer-events-none hover:bg-field transition"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Slide-over Detail Drawer */}
      <EmailDetailDrawer
        email={selectedEmail}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedEmail(null);
        }}
        onEmailCancelled={() => {
          if (onRefresh) onRefresh();
        }}
      />
    </div>
  );
};
