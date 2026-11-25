import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  subtitle: string;
  colorScheme: 'indigo' | 'emerald' | 'amber' | 'rose' | 'purple';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  subtitle,
  colorScheme,
}) => {
  const styles = {
    indigo: {
      bg: 'bg-indigo-50/70',
      text: 'text-indigo-600',
      border: 'border-indigo-100',
    },
    emerald: {
      bg: 'bg-emerald-50/70',
      text: 'text-emerald-600',
      border: 'border-emerald-100',
    },
    amber: {
      bg: 'bg-amber-50/70',
      text: 'text-amber-600',
      border: 'border-amber-100',
    },
    rose: {
      bg: 'bg-rose-50/70',
      text: 'text-rose-600',
      border: 'border-rose-100',
    },
    purple: {
      bg: 'bg-purple-50/70',
      text: 'text-purple-600',
      border: 'border-purple-100',
    },
  }[colorScheme];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs hover:shadow-sm hover:border-slate-300 transition-all duration-150">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          {title}
        </span>
        <div className={`p-2 rounded-xl ${styles.bg} ${styles.text}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="text-2xl font-extrabold text-slate-900 tracking-tight mb-1">{value}</div>
      <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${styles.text.replace('text-', 'bg-')}`}></span>
        <span>{subtitle}</span>
      </div>
    </div>
  );
};
