'use client';

import { cn } from '../../lib/utils';
import { TrustBadge } from '../trust-badge/trust-badge';
import type { TrustBadgeProps } from '../trust-badge/trust-badge';
import type { AgentId } from '@flow/types';
import { agentOverlays } from '@flow/tokens';

export interface AgentStatusItemProps {
  agentId: AgentId;
  label: string;
  color: string;
  statusRing: 'active' | 'idle' | 'thinking' | 'error' | 'offline';
  badgeProps: TrustBadgeProps | null;
  pendingCount: number;
  compact?: boolean;
}

const STATUS_RING_COLORS: Record<string, string> = {
  active: '#22c55e',
  idle: '#94a3b8',
  thinking: '#3b82f6',
  error: '#ef4444',
  offline: '#64748b',
};

export function AgentStatusItem({
  agentId,
  label,
  color,
  statusRing,
  badgeProps,
  pendingCount,
  compact = false,
}: AgentStatusItemProps) {
  const overlay = agentOverlays[statusRing] ?? agentOverlays.idle;
  const opacity = 'opacity' in overlay ? overlay.opacity : 1;

  if (compact) {
    return (
      <div
        className="flex items-center gap-1 px-1"
        role="listitem"
        aria-label={`${label} agent`}
        data-testid={`agent-status-${agentId}`}
      >
        <span
          className="inline-block rounded-full"
          style={{
            width: 8,
            height: 8,
            backgroundColor: color,
            opacity,
            boxShadow: `0 0 0 2px ${STATUS_RING_COLORS[statusRing]}`,
          }}
        />
        {badgeProps && <TrustBadge {...badgeProps} variant="sidebar" agentLabel={label} />}
        {pendingCount > 0 && (
          <span className="text-[10px] font-medium text-[var(--flow-color-text-muted)]">{pendingCount}</span>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn('flex items-center gap-2 rounded-md px-2 py-1.5', 'hover:bg-[var(--flow-state-overlay-hover)]')}
      role="listitem"
      aria-label={`${label} agent`}
      data-testid={`agent-status-${agentId}`}
    >
      <span
        className="inline-block rounded-full"
        style={{
          width: 12,
          height: 12,
          backgroundColor: color,
          opacity,
          boxShadow: `0 0 0 2px ${STATUS_RING_COLORS[statusRing]}`,
        }}
      />
      <span className="flex-1 truncate text-sm text-[var(--flow-color-text-secondary)]">{label}</span>
      {badgeProps && <TrustBadge {...badgeProps} variant="inline" agentLabel={label} />}
      {pendingCount > 0 && (
        <span className="rounded-full bg-[var(--flow-color-accent-gold)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--flow-color-bg-surface)]">
          {pendingCount}
        </span>
      )}
    </div>
  );
}
