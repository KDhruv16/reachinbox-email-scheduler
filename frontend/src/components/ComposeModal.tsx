import React, { useState, useRef } from 'react';
import {
  X,
  Calendar,
  Clock,
  ShieldAlert,
  Send,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Trash2,
  Eye,
  Code,
  Zap,
} from 'lucide-react';
import { emailApi } from '../api/client';
import { useAuth } from '../context/AuthContext';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sender, setSender] = useState(user?.email || 'notifications@reachinbox.ai');
  const [recipientInput, setRecipientInput] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState(
    '<h2>Hello there!</h2><p>We are delighted to invite you to test ReachInbox scheduler.</p>'
  );
  const [startTime, setStartTime] = useState('');
  const [delayBetweenEmails, setDelayBetweenEmails] = useState(2000);
  const [hourlyLimit, setHourlyLimit] = useState(100);
  const [etherealUser, setEtherealUser] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      emailApi
        .getSmtpInfo()
        .then((res) => {
          if (res.smtp?.user) {
            setEtherealUser(res.smtp.user);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const [activeBodyTab, setActiveBodyTab] = useState<'editor' | 'preview'>('editor');
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const extractEmails = (text: string): string[] => {
    const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
    return matches ? Array.from(new Set(matches.map((e) => e.toLowerCase().trim()))) : [];
  };

  const handleAddManualEmails = () => {
    if (!recipientInput.trim()) return;
    const found = extractEmails(recipientInput);
    if (found.length > 0) {
      setRecipients((prev) => Array.from(new Set([...prev, ...found])));
      setRecipientInput('');
      setError(null);
    } else {
      setError('Please enter valid email addresses');
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const found = extractEmails(content);
        if (found.length > 0) {
          setRecipients((prev) => Array.from(new Set([...prev, ...found])));
          setError(null);
        } else {
          setError('No valid email addresses found in uploaded file');
        }
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleRemoveRecipient = (email: string) => {
    setRecipients((prev) => prev.filter((r) => r !== email));
  };

  const handleClearAllRecipients = () => {
    setRecipients([]);
  };

  // Quick preset helpers
  const setQuickTime = (type: 'now' | '10m' | '1h' | 'tomorrow') => {
    const now = new Date();
    if (type === 'now') {
      setStartTime('');
    } else if (type === '10m') {
      const d = new Date(now.getTime() + 10 * 60000);
      setStartTime(formatDateTimeLocal(d));
    } else if (type === '1h') {
      const d = new Date(now.getTime() + 60 * 60000);
      setStartTime(formatDateTimeLocal(d));
    } else if (type === 'tomorrow') {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      setStartTime(formatDateTimeLocal(d));
    }
  };

  const formatDateTimeLocal = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}`;
  };

  // Campaign duration calculation
  const totalRecipients = recipients.length + (recipientInput.trim() ? extractEmails(recipientInput).length : 0);
  const estimatedSeconds = Math.max(1, Math.round(((totalRecipients - 1) * delayBetweenEmails) / 1000));
  const estimatedDuration =
    estimatedSeconds < 60
      ? `${estimatedSeconds}s`
      : `${Math.round(estimatedSeconds / 60)}m ${estimatedSeconds % 60}s`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let allRecipients = [...recipients];
    if (recipientInput.trim()) {
      const extra = extractEmails(recipientInput);
      allRecipients = Array.from(new Set([...allRecipients, ...extra]));
    }

    if (allRecipients.length === 0) {
      setError('Please add at least one recipient email address');
      return;
    }

    if (!subject.trim()) {
      setError('Email subject is required');
      return;
    }

    if (!body.trim()) {
      setError('Email body is required');
      return;
    }

    setLoading(true);

    try {
      const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const result = await emailApi.schedule({
        sender,
        recipients: allRecipients,
        subject,
        body,
        startTime: startTime ? new Date(startTime).toISOString() : undefined,
        delayBetweenEmails,
        hourlyLimit,
        batchId,
      });

      setSuccessMsg(
        `Successfully scheduled ${result.scheduledCount} email(s)!${
          result.skippedCount > 0 ? ` (${result.skippedCount} skipped duplicate)` : ''
        }`
      );

      setTimeout(() => {
        onSuccess();
        onClose();
        setRecipients([]);
        setSubject('');
        setSuccessMsg(null);
      }, 1100);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to schedule emails');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-brand-soft flex items-center justify-center text-brand">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink">Compose New Email</h2>
              <p className="text-xs text-muted">
                Schedule campaign emails with BullMQ queues & atomic rate limits
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted hover:text-ink hover:bg-field rounded-full transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded-xl">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 p-3 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Sender */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">From (Sender)</label>
              {etherealUser && sender !== etherealUser && (
                <button
                  type="button"
                  onClick={() => setSender(etherealUser)}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 hover:underline flex items-center gap-1"
                >
                  <Zap className="w-3 h-3 text-indigo-500" />
                  <span>Use Ethereal ({etherealUser.split('@')[0]})</span>
                </button>
              )}
            </div>
            <input
              type="email"
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              placeholder="e.g. sender@reachinbox.ai"
              className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
              required
            />
          </div>

          {/* Recipients / File Upload Dropzone */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Recipients ({recipients.length} detected)
              </label>
              {recipients.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllRecipients}
                  className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear list</span>
                </button>
              )}
            </div>

            {/* Recipient Manual Input */}
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={recipientInput}
                onChange={(e) => setRecipientInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddManualEmails();
                  }
                }}
                placeholder="Type email and press Enter (or paste comma-separated list)"
                className="flex-1 px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={handleAddManualEmails}
                className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
              >
                Add
              </button>
            </div>

            {/* Drag & Drop File Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-3.5 border-2 border-dashed rounded-2xl cursor-pointer text-center transition flex items-center justify-center gap-3 ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-50/50'
                  : 'border-slate-200 hover:border-slate-300 bg-slate-50/60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={handleFileUpload}
              />
              <div className="p-2 bg-white rounded-xl shadow-xs text-indigo-600">
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-xs font-semibold text-slate-700">
                  Drop CSV or TXT file here, or <span className="text-indigo-600">browse</span>
                </div>
                <div className="text-[10px] text-slate-400">
                  Parses email addresses automatically from any format
                </div>
              </div>
            </div>

            {/* Recipients Pill Cloud */}
            {recipients.length > 0 && (
              <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl max-h-28 overflow-y-auto flex flex-wrap gap-1.5">
                {recipients.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-white border border-slate-200 rounded-md text-[11px] font-medium text-slate-700 shadow-2xs"
                  >
                    <span>{email}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveRecipient(email)}
                      className="text-slate-400 hover:text-rose-600 transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Subject */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">Subject</label>
              <span className="text-[10px] text-slate-400">{subject.length}/100 chars</span>
            </div>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Elevate your outbound campaign with ReachInbox"
              className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
              required
            />
          </div>

          {/* Email Body & Preview Toggle */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">Message Content</label>
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setActiveBodyTab('editor')}
                  className={`flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition ${
                    activeBodyTab === 'editor' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  <Code className="w-3 h-3" />
                  <span>Editor</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveBodyTab('preview')}
                  className={`flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold transition ${
                    activeBodyTab === 'preview' ? 'bg-white text-indigo-600 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  <Eye className="w-3 h-3" />
                  <span>Preview</span>
                </button>
              </div>
            </div>

            {activeBodyTab === 'editor' ? (
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                placeholder="<p>Hi there,</p><p>We are reaching out to introduce our new scheduling system.</p>"
                className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
                required
              />
            ) : (
              <div
                className="p-4 border border-slate-200 rounded-xl min-h-[110px] text-xs text-slate-800 bg-slate-50/50 prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: body || '<p class="text-slate-400 italic">No content</p>' }}
              />
            )}
          </div>

          {/* Scheduling Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
            {/* Start Time with Presets */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                  <Calendar className="w-3 h-3 text-indigo-600" />
                  <span>Start Time</span>
                </label>
              </div>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
              />
              <div className="flex items-center gap-1 mt-1 text-[10px]">
                <button
                  type="button"
                  onClick={() => setQuickTime('now')}
                  className="text-indigo-600 hover:underline"
                >
                  Now
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => setQuickTime('10m')}
                  className="text-indigo-600 hover:underline"
                >
                  +10m
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => setQuickTime('tomorrow')}
                  className="text-indigo-600 hover:underline"
                >
                  Tomorrow
                </button>
              </div>
            </div>

            {/* Delay Between Sends */}
            <div>
              <label className="flex items-center gap-1 text-xs font-semibold text-slate-700 mb-1">
                <Clock className="w-3 h-3 text-indigo-600" />
                <span>Delay Between (ms)</span>
              </label>
              <select
                value={delayBetweenEmails}
                onChange={(e) => setDelayBetweenEmails(parseInt(e.target.value, 10))}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 bg-white"
              >
                <option value={0}>0s (Immediate)</option>
                <option value={1000}>1 second</option>
                <option value={2000}>2 seconds (Standard)</option>
                <option value={5000}>5 seconds (Safe)</option>
                <option value={15000}>15 seconds</option>
                <option value={30000}>30 seconds</option>
              </select>
              <span className="text-[10px] text-slate-400 mt-1 block">Spaces individual sends</span>
            </div>

            {/* Hourly Limit */}
            <div>
              <label className="flex items-center gap-1 text-xs font-semibold text-slate-700 mb-1">
                <ShieldAlert className="w-3 h-3 text-indigo-600" />
                <span>Hourly Limit</span>
              </label>
              <select
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(parseInt(e.target.value, 10))}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 bg-white"
              >
                <option value={50}>50 / hour</option>
                <option value={100}>100 / hour (Recommended)</option>
                <option value={250}>250 / hour</option>
                <option value={500}>500 / hour</option>
              </select>
              <span className="text-[10px] text-slate-400 mt-1 block">Atomic Redis rate limit</span>
            </div>
          </div>

          {/* Campaign Summary Banner */}
          {totalRecipients > 0 && (
            <div className="p-3 bg-brand-soft border border-[#cce9d4] rounded-xl flex items-center justify-between text-xs text-brand-dark">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-brand flex-shrink-0" />
                <span>
                  Queueing <strong>{totalRecipients}</strong> email(s). Estimated total runtime:{' '}
                  <strong>{estimatedDuration}</strong>.
                </span>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-muted hover:text-ink transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full border border-brand bg-white px-5 h-9 text-sm font-medium text-brand hover:bg-brand-soft transition disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <div className="w-3.5 h-3.5 border-2 border-brand border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>{startTime ? 'Schedule Batch' : 'Send'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
