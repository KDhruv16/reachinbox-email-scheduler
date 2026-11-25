import React, { useState, useEffect } from 'react';
import { emailApi } from '../api/client';
import { EmailJob } from '../types';
import { EmailTable } from '../components/EmailTable';
import { Search, RotateCw, Filter, Check } from 'lucide-react';

export const SentPage: React.FC = () => {
  const [emails, setEmails] = useState<EmailJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchSent = async () => {
    setLoading(true);
    try {
      const data = await emailApi.getSent(page, 25, search, statusFilter);
      setEmails(data.emails);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSent();
  }, [page, statusFilter]);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchSent();
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const filterOptions = [
    { label: 'All Sent & Failed', value: '' },
    { label: 'Delivered (Sent)', value: 'SENT' },
    { label: 'Failed', value: 'FAILED' },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Figma Toolbar */}
      <div className="flex items-center gap-3 pb-3 relative">
        <label className="flex h-9 flex-1 items-center gap-2 rounded-full bg-field px-3.5 text-sm">
          <Search className="size-4 text-muted shrink-0" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sent emails"
            className="h-full flex-1 bg-transparent outline-none placeholder:text-muted text-sm text-ink"
          />
        </label>

        {/* Filter Popover Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setFilterOpen((o) => !o)}
            className={`size-9 rounded-full flex items-center justify-center transition ${
              statusFilter ? 'bg-brand-soft text-brand' : 'hover:bg-field text-ink'
            }`}
            title="Filter by status"
          >
            <Filter className="size-4 text-muted" />
          </button>

          {filterOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-white border border-line p-1 shadow-lg z-30">
              {filterOptions.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => {
                    setStatusFilter(opt.value);
                    setFilterOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium text-ink hover:bg-field transition"
                >
                  <span>{opt.label}</span>
                  {statusFilter === opt.value && <Check className="size-3.5 text-brand" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Refresh Button */}
        <button
          type="button"
          onClick={fetchSent}
          className="size-9 rounded-full flex items-center justify-center hover:bg-field text-ink transition"
          title="Refresh mailbox"
        >
          <RotateCw className={`size-4 text-muted ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Email Table List */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <EmailTable
          emails={emails}
          loading={loading}
          total={total}
          page={page}
          limit={25}
          onPageChange={setPage}
          onRefresh={fetchSent}
        />
      </div>
    </div>
  );
};
