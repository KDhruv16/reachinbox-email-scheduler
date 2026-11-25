import React from 'react';

export const LoadingSkeleton: React.FC<{ rows?: number }> = ({ rows = 5 }) => {
  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200 p-6 space-y-4 animate-pulse">
      <div className="h-6 bg-slate-100 rounded-md w-1/4"></div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-12 bg-slate-50 rounded-xl flex items-center px-4 gap-4">
            <div className="w-8 h-8 rounded-full bg-slate-200"></div>
            <div className="h-4 bg-slate-200 rounded w-1/3"></div>
            <div className="h-4 bg-slate-100 rounded w-1/4"></div>
            <div className="h-4 bg-slate-100 rounded w-1/6 ml-auto"></div>
          </div>
        ))}
      </div>
    </div>
  );
};
