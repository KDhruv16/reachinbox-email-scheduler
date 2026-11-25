import React, { useState, useEffect } from 'react';
import { healthApi, API_BASE } from '../api/client';
import { ExternalLink, RotateCw, Server, Database, Activity } from 'lucide-react';

export const MonitoringPage: React.FC = () => {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const data = await healthApi.check();
      setHealth(data);
    } catch (err: any) {
      setHealth({ status: 'degraded', error: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const bullBoardUrl = `${API_BASE}/admin/queues`;

  return (
    <div className="flex h-full flex-col space-y-4 overflow-y-auto pr-1">
      {/* Header Toolbar */}
      <div className="flex items-center justify-between pb-3 border-b border-line">
        <div>
          <h1 className="text-lg font-semibold text-ink">Queue & Infrastructure Monitor</h1>
          <p className="text-xs text-muted">
            Inspect real-time BullMQ queue state, worker processing, and service connections
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchHealth}
            className="size-9 rounded-full flex items-center justify-center hover:bg-field text-ink transition"
            title="Refresh System Health"
          >
            <RotateCw className={`size-4 text-muted ${loading ? 'animate-spin' : ''}`} />
          </button>
          <a
            href={bullBoardUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-4 h-9 rounded-full border border-brand bg-white text-xs font-medium text-brand hover:bg-brand-soft transition"
          >
            <span>Open Bull Board</span>
            <ExternalLink className="size-3" />
          </a>
        </div>
      </div>

      {/* Health Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-field rounded-xl border border-line">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted font-medium">PostgreSQL Database</span>
            <Database className="size-4 text-muted" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`size-2 rounded-full ${
                health?.services?.database === 'connected' ? 'bg-brand' : 'bg-rose-500'
              }`}
            />
            <span className="text-sm font-semibold text-ink capitalize">
              {health?.services?.database || 'Checking...'}
            </span>
          </div>
        </div>

        <div className="p-4 bg-field rounded-xl border border-line">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted font-medium">Redis Cluster</span>
            <Server className="size-4 text-muted" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`size-2 rounded-full ${
                health?.services?.redis === 'connected' ? 'bg-brand' : 'bg-rose-500'
              }`}
            />
            <span className="text-sm font-semibold text-ink capitalize">
              {health?.services?.redis || 'Checking...'}
            </span>
          </div>
        </div>

        <div className="p-4 bg-field rounded-xl border border-line">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted font-medium">Elasticsearch</span>
            <Activity className="size-4 text-muted" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`size-2 rounded-full ${
                health?.services?.elasticsearch === 'connected' ? 'bg-brand' : 'bg-amber-500'
              }`}
            />
            <span className="text-sm font-semibold text-ink capitalize">
              {health?.services?.elasticsearch || 'Checking...'}
            </span>
          </div>
        </div>
      </div>

      {/* Embedded Live Bull Board Iframe */}
      <div className="flex-1 min-h-[500px] bg-white rounded-xl border border-line overflow-hidden flex flex-col">
        <div className="px-4 py-2 bg-field border-b border-line flex items-center justify-between text-xs text-muted">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-brand animate-pulse"></span>
            <span className="font-medium text-ink">BullMQ Live Dashboard (/admin/queues)</span>
          </div>
          <span className="text-[11px]">Real-time Queue Visualization</span>
        </div>
        <iframe
          src={bullBoardUrl}
          title="BullMQ Queue Board"
          className="w-full flex-1 border-0"
        />
      </div>
    </div>
  );
};
