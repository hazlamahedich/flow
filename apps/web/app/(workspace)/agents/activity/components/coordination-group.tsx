'use client';

import { useState } from 'react';
import { AGENT_IDENTITY } from '@flow/shared';
import type { AgentId } from '@flow/types';
import type { CoordinationGroup, ActionHistoryRow } from '@flow/db';
import { TimelineEntry } from './timeline-entry';
import { COORDINATION_LABELS } from '../../constants/activity-copy';

interface CoordinationGroupProps {
  group: CoordinationGroup;
  workspaceId: string;
}

export function CoordinationGroupComponent({ group, workspaceId }: CoordinationGroupProps) {
  const [expanded, setExpanded] = useState(false);
  const agents = group.agents.map((id) => AGENT_IDENTITY[id as AgentId]);
  const initiator = group.initiatorAgentId ? AGENT_IDENTITY[group.initiatorAgentId as AgentId] : null;
  const isInitiator = (agentId: string) => agentId === group.initiatorAgentId;

  return (
    <div className="border border-[var(--flow-color-border)] rounded-lg overflow-hidden" role="listitem">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-[var(--flow-color-surface-elevated)]"
        aria-expanded={expanded}
      >
        <div className="flex -space-x-1">
          {agents.slice(0, 3).map((a) => (
            <div
              key={a.id}
              className={`rounded-full flex items-center justify-center text-xs font-medium border-2 border-white ${isInitiator(a.id) ? 'h-9 w-9 text-sm' : 'h-7 w-7'}`}
              style={{ backgroundColor: a.color + '20', color: a.color }}
              aria-hidden="true"
            >
              {a.iconInitial}
            </div>
          ))}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-[var(--flow-color-text-primary)]">
            {COORDINATION_LABELS.agentCount(group.runCount)}
          </div>
          <div className="text-xs text-[var(--flow-color-text-secondary)]">
            {agents.map((a) => a.label).join(' → ')}
            {initiator && <span className="ml-1 text-[var(--flow-color-primary)]">· {COORDINATION_LABELS.initiator}: {initiator.label}</span>}
          </div>
        </div>
        <span className="text-xs text-[var(--flow-color-text-secondary)]">
          {expanded ? COORDINATION_LABELS.collapsed : COORDINATION_LABELS.expanded}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-[var(--flow-color-border)] pl-6 relative">
          <div className="absolute left-4 top-0 bottom-0 w-px bg-[var(--flow-color-border)]" aria-hidden="true" />
          <div className="absolute left-[11px] bottom-2 text-[var(--flow-color-border)] text-[8px] rotate-180" aria-hidden="true">▼</div>
          <div className="divide-y divide-[var(--flow-color-border)]">
            {group.runs.map((run) => (
              <TimelineEntry key={run.id} entry={run} workspaceId={workspaceId} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
