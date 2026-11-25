import React, { useState, useEffect } from 'react';
import { emailApi } from '../api/client';
import { DashboardStats, EmailJob } from '../types';
import { StatCard } from '../components/StatCard';
import { EmailTable } from '../components/EmailTable';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { EmptyState } from '../components/EmptyState';
import {
  CalendarClock,
  CheckCircle,
  AlertOctagon,
  Clock,
  Search,
  RefreshCw,
  Plus,
  Send,
} from 'lucide-react';

interface DashboardPageProps {
  onOpenCompose: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onOpenCompose }) => {
  const [stats, setStats] = useState<DashboardStats>({
    totalScheduled: 0,
    totalSent: 0,
    totalFailed: 0,
    totalDelayed: 0,
    totalOverall: 0,
  });

  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [statusFilter, setStatusFilter] = useState('');
  const [emails, setEmails] = useState<EmailJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchDashboardData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const statsRes = await emailApi.getStats();
      setStats(statsRes);

      if (activeTab === 'scheduled') {
        const schedRes = await emailApi.getScheduled(page, 15, searchQuery, statusFilter);
        setEmails(schedRes.emails);
        setTotal(schedRes.total);
      } else {
        const sentRes = await emailApi.getSent(page, 15, searchQuery, statusFilter);
        setEmails(sentRes.emails);
        setTotal(sentRes.total);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchDashboardData();
  }, [activeTab, statusFilter]);

  useEffect(() => {
    fetchDashboardData();
  }, [page]);

  // Auto-refresh interval (every 6 seconds) for real-time dispatch monitoring
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchDashboardData(true);
    }, 6000);
    return () => clearInterval(interval);
  }, [autoRefresh, activeTab, statusFilter, page, searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchDashboardData();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
              Overview
            </span>
            <span className="text-xs text-slate-400">· Real-time Email Dispatcher</span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Campaign Dispatcher</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time BullMQ queue metrics, atomic rate limiting & Ethereal SMTP test deliveries
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
              autoRefresh
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
            title="Toggle Live Polling"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
            <span>Live Sync {autoRefresh ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={() => fetchDashboardData()}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition"
            title="Refresh now"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenCompose}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs shadow-indigo-200 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Compose Email</span>
          </button>
        </div>
      </div>

      {/* 4 Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Scheduled Queue"
          value={stats.totalScheduled}
          subtitle="Waiting in BullMQ queue"
          icon={CalendarClock}
          colorScheme="indigo"
        />
        <StatCard
          title="Delivered (Sent)"
          value={stats.totalSent}
          subtitle="Sent via Ethereal SMTP"
          icon={CheckCircle}
          colorScheme="emerald"
        />
        <StatCard
          title="Rate-Limited"
          value={stats.totalDelayed}
          subtitle="Rescheduled to next window"
          icon={Clock}
          colorScheme="amber"
        />
        <StatCard
          title="Failed Dispatches"
          value={stats.totalFailed}
          subtitle="Exhausted retries"
          icon={AlertOctagon}
          colorScheme="rose"
        />
      </div>

      {/* Main Tabs and Search Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-slate-200/90 shadow-2xs">
          {/* Tabs */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setActiveTab('scheduled');
                setStatusFilter('');
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                activeTab === 'scheduled'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <CalendarClock className="w-3.5 h-3.5" />
              <span>Scheduled Queue ({stats.totalScheduled + stats.totalDelayed})</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('sent');
                setStatusFilter('');
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                activeTab === 'sent'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Sent History ({stats.totalSent + stats.totalFailed})</span>
            </button>
          </div>

          {/* Search & Filters */}
          <div className="flex items-center gap-2">
            {/* Status Sub-Filters */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 bg-white font-medium text-slate-700"
            >
              <option value="">All Statuses</option>
              {activeTab === 'scheduled' ? (
                <>
                  <option value="SCHEDULED">Scheduled Only</option>
                  <option value="DELAYED">Rate-Limited (Delayed)</option>
                  <option value="PROCESSING">Processing</option>
                </>
              ) : (
                <>
                  <option value="SENT">Delivered (Sent)</option>
                  <option value="FAILED">Failed</option>
                </>
              )}
            </select>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="flex items-center gap-1.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search subject, recipient, body..."
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl w-56 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <button
                type="submit"
                className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
              >
                Search
              </button>
            </form>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <LoadingSkeleton rows={5} />
        ) : emails.length === 0 ? (
          <EmptyState
            title={activeTab === 'scheduled' ? 'No Scheduled Emails' : 'No Sent Emails Yet'}
            description={
              activeTab === 'scheduled'
                ? 'You have no pending or delayed email jobs in BullMQ. Click Compose Email to start a batch.'
                : 'Emails will appear here once processed by the BullMQ worker with Ethereal preview links.'
            }
            actionText="Compose New Batch"
            onAction={onOpenCompose}
          />
        ) : (
          <EmailTable
            emails={emails}
            total={total}
            page={page}
            limit={15}
            onPageChange={(p) => setPage(p)}
            onRefresh={() => fetchDashboardData()}
          />
        )}
      </div>
    </div>
  );
};
