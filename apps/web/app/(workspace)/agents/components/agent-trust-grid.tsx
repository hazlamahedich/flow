'use client';

import { useEffect, useMemo } from 'react';
import { useSetAtom, useAtomValue } from 'jotai';
import { TRUST_BADGE_DISPLAY, deriveBadgeState } from '@flow/trust';
import type { TrustBadgeState } from '@flow/trust';
import type { AgentId } from '@flow/types';
import { AGENT_IDENTITY, AGENT_IDS } from '@flow/shared';
import { TrustBadgeWrapper } from './trust-badge-wrapper';
import { trustBadgeMapAtom, type TrustBadgeData } from '@/lib/atoms/trust';
import type { TrustSummaryRow } from '../lib/trust-summary';

interface AgentTrustGridProps {
  workspaceId: string;
  initialData: TrustSummaryRow[];
}

function daysBetween(dateStr: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(dateStr).getTime()) / 86_400_000));
}

export function AgentTrustGrid({ workspaceId, initialData }: AgentTrustGridProps) {
  const setBadgeMap = useSetAtom(trustBadgeMapAtom);
  const badgeMap = useAtomValue(trustBadgeMapAtom);

  useEffect(() => {
    const now = new Date();
    const map = new Map<string, TrustBadgeData>();

    for (const row of initialData) {
      const state = deriveBadgeState(
        {
          id: '',
          workspaceId: row.workspaceId,
          agentId: row.agentId,
          actionType: '',
          currentLevel: row.currentLevel,
          score: row.score,
          totalExecutions: row.totalExecutions,
          successfulExecutions: row.successfulExecutions,
          consecutiveSuccesses: row.consecutiveSuccesses,
          violationCount: row.violationCount,
          lastTransitionAt: new Date(row.lastTransitionAt),
          lastViolationAt: row.lastViolationAt ? new Date(row.lastViolationAt) : null,
          cooldownUntil: null,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        now,
      );
      map.set(`${row.workspaceId}:${row.agentId}`, {
        agentId: row.agentId,
        state,
        score: row.score,
        consecutiveSuccesses: row.consecutiveSuccesses,
        totalExecutions: row.totalExecutions,
        daysAtLevel: daysBetween(row.lastTransitionAt, now),
      });
    }

    for (const agentId of AGENT_IDS) {
      const key = `${workspaceId}:${agentId}`;
      if (!map.has(key)) {
        map.set(key, {
          agentId,
          state: 'supervised' as TrustBadgeState,
          score: 0,
          consecutiveSuccesses: 0,
          totalExecutions: 0,
          daysAtLevel: 0,
        });
      }
    }

    setBadgeMap(map);
  }, [initialData, setBadgeMap, workspaceId]);

  const dataMap = useMemo(() => new Map(initialData.map((r) => [r.agentId, r])), [initialData]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="agent-trust-grid">
      {AGENT_IDS.map((agentId) => {
        const identity = AGENT_IDENTITY[agentId];
        const atomData = badgeMap.get(`${workspaceId}:${agentId}`);
        const row = dataMap.get(agentId);
        const state: TrustBadgeState = atomData?.state ?? 'supervised';
        const display = TRUST_BADGE_DISPLAY[state];

        return (
          <div
            key={agentId}
            className="rounded-lg border border-[var(--flow-color-border-default)] bg-[var(--flow-color-bg-surface)] p-4"
            data-testid={`agent-card-${agentId}`}
          >
            <div className="flex items-center gap-3 mb-3">
              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold"
                style={{ backgroundColor: identity.color, color: '#fff' }}
              >
                {identity.iconInitial}
              </span>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-medium text-[var(--flow-color-text-primary)] truncate">
                  {identity.label}
                </h2>
                <div style={{ minHeight: 20 }}>
                  <TrustBadgeWrapper workspaceId={workspaceId} agentId={agentId} />
                </div>
              </div>
            </div>

            {state === 'supervised' && row && (
              <div className="space-y-1 text-xs text-[var(--flow-color-text-secondary)]">
                <div className="flex justify-between"><span>Score</span><span>{row.score}/200</span></div>
                <div className="flex justify-between"><span>Consecutive</span><span>{row.consecutiveSuccesses}</span></div>
                <div className="flex justify-between"><span>Rejections</span><span>{row.violationCount}</span></div>
              </div>
            )}

            {state === 'confirm' && row && (
              <div className="space-y-1 text-xs text-[var(--flow-color-text-secondary)]">
                <div className="flex justify-between"><span>Level</span><span>{display.label}</span></div>
                <div className="flex justify-between"><span>Days at level</span><span>{atomData?.daysAtLevel ?? 0}</span></div>
              </div>
            )}

            {state === 'auto' && row && (
              <div className="flex items-center gap-2 text-xs text-[var(--flow-color-text-secondary)]">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--flow-emotion-trust-auto)' }} />
                <span>{display.label}</span>
              </div>
            )}

            {state === 'promoting' && (
              <div className="text-xs text-[var(--flow-color-text-muted)] italic">Awaiting confirmation&hellip;</div>
            )}

            {state === 'regressing' && (
              <div className="text-xs text-[var(--flow-color-text-muted)] italic">Reviewing changes</div>
            )}

            {state === 'stick_time' && (
              <div className="text-xs text-[var(--flow-color-text-secondary)]">{display.label}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
