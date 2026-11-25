import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Clock,
  Send,
  Sliders,
  Layers,
  ChevronDown,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { emailApi } from '../api/client';

interface SidebarProps {
  onOpenCompose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenCompose }) => {
  const { user, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [counts, setCounts] = useState<{ scheduled: number; sent: number }>({ scheduled: 0, sent: 0 });

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const stats = await emailApi.getStats();
        setCounts({
          scheduled: (stats.totalScheduled || 0) + (stats.totalDelayed || 0),
          sent: stats.totalSent || 0,
        });
      } catch {
        // quiet fallback
      }
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="w-[210px] shrink-0 flex flex-col gap-3 px-2 pt-2.5 bg-white select-none">
      {/* Figma Logo */}
      <div className="px-2 pb-0.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="font-pixel text-[26px] leading-none tracking-tight text-black select-none font-bold">
            ONB
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-brand"></span>
        </div>
      </div>

      {/* User Profile Card with Dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setUserMenuOpen((o) => !o)}
          className="flex w-full items-center gap-2.5 rounded-xl bg-field px-2.5 py-2 text-left transition-colors hover:bg-[#eceeec]"
        >
          {user?.avatar ? (
            <img src={user.avatar} alt={user.name} className="size-8 rounded-full object-cover shrink-0" />
          ) : (
            <div className="size-8 rounded-full bg-[#e2e8f0] text-ink font-semibold flex items-center justify-center text-xs shrink-0">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">{user?.name || 'User'}</span>
            <span className="block truncate text-[11px] text-muted">{user?.email || 'user@outbox.ai'}</span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted" />
        </button>

        {userMenuOpen && (
          <div className="absolute top-full left-0 mt-1 w-full z-30 rounded-xl bg-white border border-line p-1 shadow-lg">
            <button
              type="button"
              onClick={() => {
                setUserMenuOpen(false);
                logout();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition"
            >
              <LogOut className="size-3.5" />
              <span>Log out</span>
            </button>
          </div>
        )}
      </div>

      {/* Compose Button matching Figma */}
      <button
        type="button"
        onClick={onOpenCompose}
        className="flex h-9 w-full items-center justify-center rounded-full border border-brand text-sm font-medium text-brand transition-colors hover:bg-brand-soft"
      >
        Compose
      </button>

      {/* Navigation Sections */}
      <nav className="mt-1 flex flex-col gap-0.5">
        <span className="px-3 pb-1 text-[11px] font-medium tracking-wide text-muted uppercase">
          Core
        </span>
        <NavLink
          to="/scheduled"
          className={({ isActive }) =>
            `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
              isActive ? 'bg-brand-soft font-semibold text-ink' : 'text-ink hover:bg-field'
            }`
          }
        >
          <Clock className="size-4 text-muted" />
          <span className="flex-1">Scheduled</span>
          {counts.scheduled > 0 && (
            <span className="text-xs font-normal text-muted">{counts.scheduled}</span>
          )}
        </NavLink>

        <NavLink
          to="/sent"
          className={({ isActive }) =>
            `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
              isActive ? 'bg-brand-soft font-semibold text-ink' : 'text-ink hover:bg-field'
            }`
          }
        >
          <Send className="size-4 text-muted" />
          <span className="flex-1">Sent</span>
          {counts.sent > 0 && (
            <span className="text-xs font-normal text-muted">{counts.sent}</span>
          )}
        </NavLink>

        <span className="px-3 pt-3 pb-1 text-[11px] font-medium tracking-wide text-muted uppercase">
          Tools
        </span>
        <NavLink
          to="/monitoring"
          className={({ isActive }) =>
            `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
              isActive ? 'bg-brand-soft font-semibold text-ink' : 'text-ink hover:bg-field'
            }`
          }
        >
          <Layers className="size-4 text-muted" />
          <span className="flex-1">Queue Monitor</span>
        </NavLink>

        <NavLink
          to="/integrations"
          className={({ isActive }) =>
            `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
              isActive ? 'bg-brand-soft font-semibold text-ink' : 'text-ink hover:bg-field'
            }`
          }
        >
          <Sliders className="size-4 text-muted" />
          <span className="flex-1">Integrations</span>
        </NavLink>
      </nav>
    </aside>
  );
};
