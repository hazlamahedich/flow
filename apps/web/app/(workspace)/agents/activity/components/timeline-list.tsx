'use client';

import { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import type { ActionHistoryRow, ActionHistoryFilters, CoordinationGroup } from '@flow/db';
import { EMPTY_STATE_NEVER, EMPTY_STATE_FILTERED, EMPTY_STATE_ERROR } from '../../constants/activity-copy';
import { TimelineEntry } from './timeline-entry';
import { CoordinationGroupComponent } from './coordination-group';

function buildPageUrl(searchParamsStr: string, page: number): string {
  const params = new URLSearchParams(searchParamsStr);
  params.set('page', String(page));
  return params.toString();
}

interface TimelineListProps {
  entries: ActionHistoryRow[];
  totalCount: number;
  filters: ActionHistoryFilters;
  grouped: boolean;
  onToggleGrouped: () => void;
  workspaceId: string;
  userId: string;
  searchParamsStr: string;
}

function groupByDate(entries: ActionHistoryRow[]): Map<string, ActionHistoryRow[]> {
  const map = new Map<string, ActionHistoryRow[]>();
  for (const entry of entries) {
    const date = new Date(entry.createdAt).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    if (!map.has(date)) map.set(date, []);
    map.get(date)!.push(entry);
  }
  return map;
}

function groupByCorrelation(entries: ActionHistoryRow[]): CoordinationGroup[] {
  const map = new Map<string, ActionHistoryRow[]>();
  for (const entry of entries) {
    const cid = entry.correlationId;
    if (!map.has(cid)) map.set(cid, []);
    map.get(cid)!.push(entry);
  }
  const groups: CoordinationGroup[] = [];
  for (const [correlationId, runs] of map) {
    if (runs.length < 2) continue;
    const sorted = [...runs].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const agents = [...new Set(sorted.map((r) => r.agentId))];
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    groups.push({
      correlationId,
      signalCount: 0,
      runCount: sorted.length,
      agents,
      firstCreatedAt: first?.createdAt ?? new Date().toISOString(),
      lastCompletedAt: last?.completedAt ?? null,
      runs: sorted,
      initiatorAgentId: first?.agentId ?? null,
    });
  }
  return groups;
}

export function TimelineList({ entries, totalCount, filters, grouped, onToggleGrouped, workspaceId, userId, searchParamsStr }: TimelineListProps) {
  const dateGroups = useMemo(() => groupByDate(entries), [entries]);
  const coordinationGroups = useMemo(() => groupByCorrelation(entries), [entries]);
  const hasFilters = filters.agentId || filters.status || filters.dateFrom || filters.dateTo;
  const page = filters.page ?? 1;
  const totalPages = Math.ceil(totalCount / 25);
  const [focusIndex, setFocusIndex] = useState(-1);
  const entryRefs = useRef<Map<number, HTMLElement>>(new Map());

  const allEntryIds = useMemo(() => {
    if (grouped && coordinationGroups.length > 0) {
      return coordinationGroups.flatMap((g) => g.runs.map((r) => r.id));
    }
    return entries.map((e) => e.id);
  }, [grouped, coordinationGroups, entries]);

  const handleGlobalKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'g' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      e.preventDefault();
      onToggleGrouped();
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusIndex((prev) => {
        const next = Math.min(prev + 1, allEntryIds.length - 1);
        entryRefs.current.get(next)?.focus();
        return next;
      });
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusIndex((prev) => {
        const next = Math.max(prev - 1, 0);
        entryRefs.current.get(next)?.focus();
        return next;
      });
    }
  }, [onToggleGrouped, allEntryIds.length]);

  useEffect(() => {
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleGlobalKeyDown]);

  if (entries.length === 0 && totalCount === 0 && !hasFilters) {
    return <p className="py-12 text-center text-[var(--flow-color-text-secondary)]">{EMPTY_STATE_NEVER}</p>;
  }
  if (entries.length === 0 && hasFilters) {
    return (
      <div className="py-12 text-center space-y-2">
        <p className="text-[var(--flow-color-text-secondary)]">{EMPTY_STATE_FILTERED}</p>
        <a href="/agents/activity" className="text-sm text-[var(--flow-color-primary)] hover:underline">Reset filters</a>
      </div>
    );
  }

  return (
    <div className="space-y-4" role="list" aria-label="Agent activity timeline" aria-live="polite">
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleGrouped}
          className="text-xs px-2 py-1 rounded border border-[var(--flow-color-border)] hover:bg-[var(--flow-color-surface-elevated)]"
          aria-pressed={grouped}
          aria-keyshortcuts="g"
        >
          {grouped ? 'Ungrouped' : 'Grouped'}
        </button>
      </div>

      {grouped && coordinationGroups.length > 0 ? (
        coordinationGroups.map((group) => (
          <CoordinationGroupComponent key={group.correlationId} group={group} workspaceId={workspaceId} />
        ))
      ) : (
        Array.from(dateGroups.entries()).map(([date, dateEntries]) => (
          <div key={date}>
            <div className="text-xs font-medium text-[var(--flow-color-text-secondary)] py-2 border-b border-[var(--flow-color-border)]">
              {date}
            </div>
            <div className="divide-y divide-[var(--flow-color-border)]">
              {dateEntries.map((entry, idx) => {
                const globalIdx = entries.indexOf(entry);
                return (
                  <TimelineEntry
                    key={entry.id}
                    entry={entry}
                    workspaceId={workspaceId}
                    ref={(el) => { if (el) entryRefs.current.set(globalIdx, el); }}
                  />
                );
              })}
            </div>
          </div>
        ))
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          {page > 1 && (
            <a href={`/agents/activity?${buildPageUrl(searchParamsStr, page - 1)}`}
              className="px-3 py-1 text-sm rounded border border-[var(--flow-color-border)] hover:bg-[var(--flow-color-surface-elevated)]">
              Previous
            </a>
          )}
          <span className="text-sm text-[var(--flow-color-text-secondary)]">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <a href={`/agents/activity?${buildPageUrl(searchParamsStr, page + 1)}`}
              className="px-3 py-1 text-sm rounded border border-[var(--flow-color-border)] hover:bg-[var(--flow-color-surface-elevated)]">
              Next
            </a>
          )}
        </div>
      )}
    </div>
  );
}
