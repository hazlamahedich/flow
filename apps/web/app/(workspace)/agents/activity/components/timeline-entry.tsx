'use client';

import { AGENT_IDENTITY } from '@flow/shared';
import type { ActionHistoryRow } from '@flow/db';
import { useState } from 'react';
import { ActionDetailPanel } from './action-detail-panel';

interface TimelineEntryProps {
  entry: ActionHistoryRow;
  workspaceId: string;
}

const STATUS_BADGE: Record<string, { text: string; icon: string; className: string }> = {
  completed: { text: 'Completed', icon: '✓', className: 'bg-green-100 text-green-700' },
  failed: { text: 'Failed', icon: '⚠', className: 'bg-amber-100 text-amber-700' },
  timed_out: { text: 'Timed out', icon: '⏱', className: 'bg-amber-100 text-amber-700' },
  waiting_approval: { text: 'Pending', icon: '◷', className: 'bg-blue-100 text-blue-700' },
  running: { text: 'Running', icon: '▶', className: 'bg-blue-100 text-blue-700' },
  queued: { text: 'Queued', icon: '○', className: 'bg-gray-100 text-gray-700' },
  cancelled: { text: 'Cancelled', icon: '✕', className: 'bg-gray-100 text-gray-600' },
};

export function TimelineEntry({ entry, workspaceId }: TimelineEntryProps) {
  const [detailOpen, setDetailOpen] = useState(false);
  const identity = AGENT_IDENTITY[entry.agentId];
  const badge = STATUS_BADGE[entry.status] ?? { text: entry.status, icon: '●', className: 'bg-gray-100 text-gray-600' };
  const relativeTime = getRelativeTime(entry.createdAt);

  return (
    <>
      <div
        role="listitem"
        tabIndex={0}
        onClick={() => setDetailOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailOpen(true); } }}
        className="flex items-center gap-3 py-3 px-2 cursor-pointer hover:bg-[var(--flow-color-surface-elevated)] rounded-md"
        aria-label={`${identity.label} ${entry.actionType} ${badge.text}`}
      >
        <div
          className="h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0"
          style={{ backgroundColor: identity.color + '20', color: identity.color }}
          aria-hidden="true"
        >
          {identity.iconInitial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--flow-color-text-primary)]">{identity.label}</span>
            <span className="text-xs text-[var(--flow-color-text-secondary)]">{entry.actionType}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs px-1.5 py-0.5 rounded inline-flex items-center gap-1 ${badge.className}`}><span aria-hidden="true">{badge.icon}</span>{badge.text}</span>
            <span className="text-xs text-[var(--flow-color-text-secondary)]" title={entry.createdAt}>{relativeTime}</span>
          </div>
        </div>
        {entry.correctionIssued && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">Corrected</span>
        )}
      </div>
      {detailOpen && (
        <ActionDetailPanel
          entry={entry}
          workspaceId={workspaceId}
          onClose={() => setDetailOpen(false)}
        />
      )}
    </>
  );
}

function getRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
