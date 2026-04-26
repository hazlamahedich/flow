'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AGENT_IDENTITY, AGENT_IDS } from '@flow/shared';
import type { AgentRunStatus } from '@flow/types';
import type { ActionHistoryFilters } from '@flow/db';

interface ActivityFiltersProps {
  filters: ActionHistoryFilters;
  totalCount: number;
}

export function ActivityFilters({ filters, totalCount }: ActivityFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  const updateFilter = useCallback((key: string, value: string | undefined) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page');
    router.push(`/agents/activity?${params.toString()}`);
  }, [router, searchParams]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        setCollapsed((prev) => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div ref={containerRef} className="flex flex-wrap gap-3 items-center" role="search" aria-label="Filter agent activity" aria-keyshortcuts="f">
      {!collapsed && (
        <>
          <select
            value={filters.agentId ?? ''}
            onChange={(e) => updateFilter('agent', e.target.value || undefined)}
            className="h-9 rounded-md border border-[var(--flow-color-border)] bg-[var(--flow-color-surface)] px-3 text-sm"
            aria-label="Filter by agent"
          >
            <option value="">All agents</option>
            {AGENT_IDS.map((id) => (
              <option key={id} value={id}>{AGENT_IDENTITY[id].label}</option>
            ))}
          </select>

          <select
            value={filters.status ?? ''}
            onChange={(e) => updateFilter('status', e.target.value || undefined)}
            className="h-9 rounded-md border border-[var(--flow-color-border)] bg-[var(--flow-color-surface)] px-3 text-sm"
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="timed_out">Timed out</option>
          </select>

          <input
            type="date"
            value={filters.dateFrom ?? ''}
            onChange={(e) => updateFilter('dateFrom', e.target.value || undefined)}
            className="h-9 rounded-md border border-[var(--flow-color-border)] bg-[var(--flow-color-surface)] px-3 text-sm"
            aria-label="From date"
          />
          <input
            type="date"
            value={filters.dateTo ?? ''}
            onChange={(e) => updateFilter('dateTo', e.target.value || undefined)}
            className="h-9 rounded-md border border-[var(--flow-color-border)] bg-[var(--flow-color-surface)] px-3 text-sm"
            aria-label="To date"
          />
        </>
      )}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="text-xs px-2 py-1 rounded border border-[var(--flow-color-border)] hover:bg-[var(--flow-color-surface-elevated)]"
        >
          Show filters
        </button>
      )}
    </div>
  );
}
