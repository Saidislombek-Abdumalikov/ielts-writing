import React from 'react';

export function Skeleton({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`animate-pulse rounded-xl bg-slate-800/50 dark:bg-slate-800/40 ${className}`} {...props} />
  );
}

export function SkeletonTaskCard() {
  return (
    <div className="glass-card p-6 rounded-2xl border border-slate-800/60 flex flex-col justify-between h-64 space-y-4">
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
      <div className="pt-4 border-t border-slate-800/40 flex justify-between items-center">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-24 rounded-xl" />
      </div>
    </div>
  );
}

export function SkeletonMetricCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="glass-card p-5 rounded-2xl border border-slate-800/60 flex items-center space-x-4">
          <Skeleton className="w-12 h-12 rounded-xl" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable() {
  return (
    <div className="glass-card rounded-2xl border border-slate-800/60 p-4 space-y-3">
      <Skeleton className="h-10 w-full rounded-xl" />
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}
