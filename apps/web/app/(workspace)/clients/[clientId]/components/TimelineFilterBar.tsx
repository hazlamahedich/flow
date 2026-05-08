'use client';

import { useQueryState } from 'nuqs';
import { Mail, Bot, LayoutGrid, ChevronDown } from 'lucide-react';
import { cn } from '@flow/ui';

export function TimelineFilterBar() {
  const [type, setType] = useQueryState('type', {
    defaultValue: 'all',
    shallow: false
  });

  const [range, setRange] = useQueryState('range', {
    defaultValue: '90d',
    shallow: false
  });

  const [, setCursor] = useQueryState('cursor');

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
      <h2 className="text-xl font-bold text-[var(--flow-text-primary)]">Communication Timeline</h2>
      
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 p-1 bg-[var(--flow-bg-surface-raised)] border border-[var(--flow-border-default)] rounded-lg">
          <button
            onClick={() => { setType('all'); setCursor(null); }}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              type === 'all'
                ? "bg-[var(--flow-accent-primary)] text-[var(--flow-accent-primary-text)] shadow-sm"
                : "text-[var(--flow-text-secondary)] hover:text-[var(--flow-text-primary)]"
            )}
          >
            <LayoutGrid className="h-4 w-4" />
            All
          </button>
          <button
            onClick={() => { setType('emails'); setCursor(null); }}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              type === 'emails'
                ? "bg-[var(--flow-accent-primary)] text-[var(--flow-accent-primary-text)] shadow-sm"
                : "text-[var(--flow-text-secondary)] hover:text-[var(--flow-text-primary)]"
            )}
          >
            <Mail className="h-4 w-4" />
            Emails
          </button>
          <button
            onClick={() => { setType('agent_runs'); setCursor(null); }}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              type === 'agent_runs'
                ? "bg-[var(--flow-accent-primary)] text-[var(--flow-accent-primary-text)] shadow-sm"
                : "text-[var(--flow-text-secondary)] hover:text-[var(--flow-text-primary)]"
            )}
          >
            <Bot className="h-4 w-4" />
            Agent Actions
          </button>
        </div>

        <div className="relative">
          <select 
            value={range ?? '90d'} 
            onChange={(e) => { setRange(e.target.value); setCursor(null); }}
            className="appearance-none bg-[var(--flow-bg-surface-raised)] border border-[var(--flow-border-default)] text-[var(--flow-text-primary)] text-sm font-medium rounded-lg pl-3 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--flow-focus-ring-color)] cursor-pointer"
          >
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="all">All Time</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--flow-text-secondary)] pointer-events-none" />
        </div>
      </div>
    </div>
  );
}
