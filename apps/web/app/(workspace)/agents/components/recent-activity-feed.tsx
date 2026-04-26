'use client';

import { AGENT_IDENTITY } from '@flow/shared';
import type { ActionHistoryRow } from '@flow/db';
import Link from 'next/link';

interface RecentActivityFeedProps {
  entries: ActionHistoryRow[];
}

export function RecentActivityFeed({ entries }: RecentActivityFeedProps) {
  if (entries.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-[var(--flow-color-text-secondary)]">
        No agent activity yet. Agents will show their work here.
      </div>
    );
  }

  const groups = groupByCorrelation(entries);
  const items: Array<{ type: 'single'; entry: ActionHistoryRow } | { type: 'group'; count: number; agents: string[] }> = [];
  const seenCorrelationIds = new Set<string>();

  let i = 0;
  while (i < entries.length && items.length < 5) {
    const entry = entries[i];
    if (!entry) break;
    const cid = entry.correlationId;
    const groupEntries = entries.filter((e) => e.correlationId === cid);
    if (groupEntries.length >= 3 && !seenCorrelationIds.has(cid)) {
      seenCorrelationIds.add(cid);
      items.push({
        type: 'group' as const,
        count: groupEntries.length,
        agents: [...new Set(groupEntries.map((e) => AGENT_IDENTITY[e.agentId as keyof typeof AGENT_IDENTITY]?.label ?? e.agentId))],
      });
      i += groupEntries.length;
    } else {
      items.push({ type: 'single' as const, entry });
      i++;
    }
  }

  return (
    <div className="space-y-2">
      {items.map((item, idx) =>
        item.type === 'single' ? (
          <div key={item.entry.id} className="flex items-center gap-2 text-sm">
            <div
              className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0"
              style={{ backgroundColor: AGENT_IDENTITY[item.entry.agentId].color + '20', color: AGENT_IDENTITY[item.entry.agentId].color }}
            >
              {AGENT_IDENTITY[item.entry.agentId].iconInitial}
            </div>
            <span className="text-[var(--flow-color-text-primary)]">{AGENT_IDENTITY[item.entry.agentId].label}</span>
            <span className="text-[var(--flow-color-text-secondary)]">{item.entry.actionType}</span>
            <span className="ml-auto text-xs text-[var(--flow-color-text-secondary)]">{getRelativeTime(item.entry.createdAt)}</span>
          </div>
        ) : (
          <div key={`group-${idx}`} className="flex items-center gap-2 text-sm px-2 py-1 rounded bg-[var(--flow-color-surface-elevated)]">
            <span className="text-[var(--flow-color-text-primary)] font-medium">{item.count}-agent coordination completed</span>
            <span className="text-[var(--flow-color-text-secondary)]">({item.agents.join(', ')})</span>
          </div>
        ),
      )}
      <Link href="/agents/activity" className="text-sm text-[var(--flow-color-primary)] hover:underline block pt-1">
        View full timeline
      </Link>
    </div>
  );
}

function groupByCorrelation(entries: ActionHistoryRow[]): Map<string, ActionHistoryRow[]> {
  const map = new Map<string, ActionHistoryRow[]>();
  for (const entry of entries) {
    if (!map.has(entry.correlationId)) map.set(entry.correlationId, []);
    map.get(entry.correlationId)!.push(entry);
  }
  return map;
}

function getRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
