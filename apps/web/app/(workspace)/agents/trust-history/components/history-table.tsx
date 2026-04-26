'use client';

import { useState, useRef, useCallback, type KeyboardEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CHECKIN_COPY } from '../../constants/trust-copy';
import type { TrustEventRow } from '@flow/db';
import { HistoryEventRow } from './history-event-row';

interface HistoryTableProps {
  events: TrustEventRow[];
  total: number;
  page: number;
  pageSize: number;
}

export function HistoryTable({ events, total, page, pageSize }: HistoryTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const totalPages = Math.ceil(total / pageSize);
  const [focusedRow, setFocusedRow] = useState(-1);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  if (events.length === 0 && page === 1) {
    return (
      <div className="py-12 text-center" data-testid="history-empty">
        <p className="text-sm text-[var(--flow-color-text-secondary)]">
          {CHECKIN_COPY.history.empty}
        </p>
      </div>
    );
  }

  const goToPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (p > 1) {
      params.set('page', String(p));
    } else {
      params.delete('page');
    }
    router.push(`?${params.toString()}`);
  };

  const handleTableKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.min(focusedRow + 1, events.length - 1);
      setFocusedRow(next);
      const nextId = events[next]?.id;
      if (nextId) rowRefs.current[nextId]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = Math.max(focusedRow - 1, 0);
      setFocusedRow(prev);
      const prevId = events[prev]?.id;
      if (prevId) rowRefs.current[prevId]?.focus();
    }
  }, [focusedRow, events]);

  return (
    <div data-testid="history-table">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" onKeyDown={handleTableKeyDown}>
          <thead>
            <tr className="border-b border-[var(--flow-color-border-default)]">
              <th className="py-2 text-left text-xs font-medium text-[var(--flow-color-text-secondary)]">
                {CHECKIN_COPY.history.columns.agent}
              </th>
              <th className="py-2 text-left text-xs font-medium text-[var(--flow-color-text-secondary)]">
                {CHECKIN_COPY.history.columns.transition}
              </th>
              <th className="py-2 text-left text-xs font-medium text-[var(--flow-color-text-secondary)]">
                {CHECKIN_COPY.history.columns.reason}
              </th>
              <th className="py-2 text-left text-xs font-medium text-[var(--flow-color-text-secondary)]">
                {CHECKIN_COPY.history.columns.date}
              </th>
            </tr>
          </thead>
          <tbody>
            {events.map((event, idx) => (
              <HistoryEventRow
                key={event.id}
                event={event}
                tabIndex={focusedRow === idx ? 0 : -1}
                rowRef={(el: HTMLTableRowElement | null) => { rowRefs.current[event.id] = el; }}
                onFocus={() => setFocusedRow(idx)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-xs text-[var(--flow-color-text-secondary)]" aria-live="polite">
            Page {page} of {totalPages} ({total} events)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="rounded-md border border-[var(--flow-color-border-default)] px-3 py-1 text-xs disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="rounded-md border border-[var(--flow-color-border-default)] px-3 py-1 text-xs disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
