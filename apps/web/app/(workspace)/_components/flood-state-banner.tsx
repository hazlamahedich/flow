'use client';

import { AlertTriangle } from 'lucide-react';

export function FloodStateBanner() {
  return (
    <div className="flex items-center gap-3 p-4 mb-6 rounded-xl border border-amber-500/20 bg-amber-500/[0.03] text-amber-800 dark:text-amber-400">
      <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-amber-500/10">
        <AlertTriangle className="w-5 h-5 text-amber-500" />
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-bold uppercase tracking-tight">High Volume Detected</h3>
        <p className="text-sm opacity-80 leading-snug">
          Your inbox is experiencing a flood state (30+ urgent items). 
          I've condensed the view so you can triage faster.
        </p>
      </div>
    </div>
  );
}
