'use client';

import { useState, useRef, useCallback, type KeyboardEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AGENT_IDS, AGENT_IDENTITY } from '@flow/shared';
import { CHECKIN_COPY } from '../../constants/trust-copy';

interface HistoryFiltersProps {
  currentAgent: string | undefined;
  currentDirection: string | undefined;
  currentDateFrom: string | undefined;
  currentDateTo: string | undefined;
}

const FILTER_IDS = ['filter-agent', 'filter-direction', 'filter-from', 'filter-to', 'filter-clear'] as const;

export function HistoryFilters({
  currentAgent,
  currentDirection,
  currentDateFrom,
  currentDateTo,
}: HistoryFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const refs = useRef<Record<string, HTMLElement | null>>({});

  const setRef = useCallback((id: string) => (el: HTMLElement | null) => {
    refs.current[id] = el;
  }, []);

  const focusAt = useCallback((idx: number) => {
    const clamped = Math.max(0, Math.min(idx, FILTER_IDS.length - 1));
    setFocusedIdx(clamped);
    const id = FILTER_IDS[clamped] as string;
    refs.current[id]?.focus();
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      focusAt(focusedIdx + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      focusAt(focusedIdx - 1);
    }
  }, [focusedIdx, focusAt]);

  const updateFilter = (key: string, value: string | undefined) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page');
    router.push(`?${params.toString()}`);
  };

  const clearFilters = () => {
    router.push('?');
  };

  return (
    <div className="flex flex-wrap items-end gap-3" data-testid="history-filters" onKeyDown={handleKeyDown} role="toolbar" aria-label="Filter trust history">
      <div className="space-y-1">
        <label htmlFor="filter-agent" className="text-xs font-medium text-[var(--flow-color-text-secondary)]">
          {CHECKIN_COPY.history.filters.agent}
        </label>
        <select
          ref={setRef('filter-agent')}
          id="filter-agent"
          value={currentAgent ?? ''}
          onChange={(e) => updateFilter('agent', e.target.value || undefined)}
          tabIndex={focusedIdx === 0 ? 0 : -1}
          onFocus={() => setFocusedIdx(0)}
          className="h-9 rounded-md border border-[var(--flow-color-border-default)] bg-[var(--flow-color-bg-surface)] px-2 text-sm"
        >
          <option value="">All agents</option>
          {AGENT_IDS.map((id) => (
            <option key={id} value={id}>{AGENT_IDENTITY[id].label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor="filter-direction" className="text-xs font-medium text-[var(--flow-color-text-secondary)]">
          {CHECKIN_COPY.history.filters.direction}
        </label>
        <select
          ref={setRef('filter-direction')}
          id="filter-direction"
          value={currentDirection ?? 'all'}
          onChange={(e) => updateFilter('direction', e.target.value === 'all' ? undefined : e.target.value)}
          tabIndex={focusedIdx === 1 ? 0 : -1}
          onFocus={() => setFocusedIdx(1)}
          className="h-9 rounded-md border border-[var(--flow-color-border-default)] bg-[var(--flow-color-bg-surface)] px-2 text-sm"
        >
          <option value="all">{CHECKIN_COPY.history.filters.directionAll}</option>
          <option value="upgrade">{CHECKIN_COPY.history.filters.directionUpgrade}</option>
          <option value="regression">{CHECKIN_COPY.history.filters.directionRegression}</option>
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor="filter-from" className="text-xs font-medium text-[var(--flow-color-text-secondary)]">
          {CHECKIN_COPY.history.filters.dateFrom}
        </label>
        <input
          ref={setRef('filter-from') as React.Ref<HTMLInputElement>}
          id="filter-from"
          type="date"
          value={currentDateFrom ?? ''}
          onChange={(e) => updateFilter('from', e.target.value || undefined)}
          tabIndex={focusedIdx === 2 ? 0 : -1}
          onFocus={() => setFocusedIdx(2)}
          className="h-9 rounded-md border border-[var(--flow-color-border-default)] bg-[var(--flow-color-bg-surface)] px-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="filter-to" className="text-xs font-medium text-[var(--flow-color-text-secondary)]">
          {CHECKIN_COPY.history.filters.dateTo}
        </label>
        <input
          ref={setRef('filter-to') as React.Ref<HTMLInputElement>}
          id="filter-to"
          type="date"
          value={currentDateTo ?? ''}
          onChange={(e) => updateFilter('to', e.target.value || undefined)}
          tabIndex={focusedIdx === 3 ? 0 : -1}
          onFocus={() => setFocusedIdx(3)}
          className="h-9 rounded-md border border-[var(--flow-color-border-default)] bg-[var(--flow-color-bg-surface)] px-2 text-sm"
        />
      </div>

      <button
        ref={setRef('filter-clear')}
        onClick={clearFilters}
        tabIndex={focusedIdx === 4 ? 0 : -1}
        onFocus={() => setFocusedIdx(4)}
        className="h-9 rounded-md border border-[var(--flow-color-border-default)] px-3 text-xs font-medium text-[var(--flow-color-text-secondary)] hover:bg-[var(--flow-color-bg-hover)]"
      >
        {CHECKIN_COPY.history.filters.clear}
      </button>
    </div>
  );
}
