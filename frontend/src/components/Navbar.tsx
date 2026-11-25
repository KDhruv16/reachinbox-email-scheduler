import React from 'react';
import { Plus } from 'lucide-react';

interface NavbarProps {
  onOpenCompose: () => void;
  title?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenCompose, title = 'Campaign Dashboard' }) => {

  return (
    <header className="h-16 bg-white border-b border-slate-200/90 px-6 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-400 font-medium">ReachInbox</span>
        <span className="text-slate-300">/</span>
        <h1 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h1>
      </div>

      <div className="flex items-center gap-4">
        {/* Real-time Status Badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50/80 border border-emerald-100 rounded-full text-[11px] font-semibold text-emerald-700">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>SMTP Engine Live</span>
        </div>

        {/* Compose Button */}
        <button
          onClick={onOpenCompose}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold transition shadow-xs shadow-indigo-200 active:scale-[0.98]"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Compose Email</span>
        </button>
      </div>
    </header>
  );
};
