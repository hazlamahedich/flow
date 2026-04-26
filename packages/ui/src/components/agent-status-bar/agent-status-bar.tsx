'use client';

import type { AgentId } from '@flow/types';
import type { TrustBadgeProps } from '../trust-badge/trust-badge';
import { AGENT_IDENTITY, AGENT_CADENCE, type CadenceTier } from '@flow/shared';
import { AgentStatusItem } from './agent-status-item';

export interface AgentStatusBarEntry {
  agentId: AgentId;
  badgeProps: TrustBadgeProps | null;
  statusRing: 'active' | 'idle' | 'thinking' | 'error' | 'offline';
  pendingCount: number;
}

export interface AgentStatusBarProps {
  agents: AgentStatusBarEntry[];
  collapsed?: boolean;
}

const TIER_ORDER: Record<CadenceTier, number> = { high: 0, low: 1, ambient: 2 };

export function AgentStatusBar({ agents, collapsed = false }: AgentStatusBarProps) {
  const sorted = [...agents].sort((a, b) => {
    const tierA = AGENT_CADENCE[a.agentId] ?? 'low';
    const tierB = AGENT_CADENCE[b.agentId] ?? 'low';
    return TIER_ORDER[tierA] - TIER_ORDER[tierB];
  });

  return (
    <div
      className="flex flex-col gap-1 py-1"
      role="region"
      aria-label="Agent status"
      data-testid="agent-status-bar"
    >
      {sorted.map((agent) => {
        const identity = AGENT_IDENTITY[agent.agentId];
        if (!identity) return null;
        const tier = AGENT_CADENCE[agent.agentId] ?? 'low';

        if (collapsed || tier === 'ambient') {
          return (
            <AgentStatusItem
              key={agent.agentId}
              agentId={agent.agentId}
              label={identity.label}
              color={identity.color}
              statusRing={agent.statusRing}
              badgeProps={agent.badgeProps}
              pendingCount={agent.pendingCount}
              compact
            />
          );
        }

        return (
          <AgentStatusItem
            key={agent.agentId}
            agentId={agent.agentId}
            label={identity.label}
            color={identity.color}
            statusRing={agent.statusRing}
            badgeProps={agent.badgeProps}
            pendingCount={agent.pendingCount}
            compact={tier === 'low'}
          />
        );
      })}
    </div>
  );
}
