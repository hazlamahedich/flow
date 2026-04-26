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

const thinkingKeyframes = `@keyframes flow-thinking-pulse {
  0%, 100% { opacity: VAR_MIN; }
  50% { opacity: VAR_MAX; }
}`;

let thinkingStylesInjected = false;

function injectThinkingStyles() {
  if (thinkingStylesInjected || typeof document === 'undefined') return;
  const overlay = agentOverlays.thinking;
  const css = thinkingKeyframes
    .replace('VAR_MIN', String(overlay.opacityMin))
    .replace('VAR_MAX', String(overlay.opacityMax));
  const sheet = document.createElement('style');
  sheet.textContent = css;
  document.head.appendChild(sheet);
  thinkingStylesInjected = true;
}

function getDotStyle(
  statusRing: AgentStatusItemProps['statusRing'],
  color: string,
  size: number,
) {
  const overlay = agentOverlays[statusRing] ?? agentOverlays.idle;
  const ringColor = STATUS_RING_COLORS[statusRing];

  if (statusRing === 'thinking' && 'opacityMin' in overlay) {
    injectThinkingStyles();
    return {
      width: size,
      height: size,
      backgroundColor: color,
      boxShadow: `0 0 0 2px ${ringColor}`,
      animation: `flow-thinking-pulse ${overlay.duration} ${overlay.easing} infinite`,
    };
  }

  const opacity = 'opacity' in overlay ? overlay.opacity : 1;
  return {
    width: size,
    height: size,
    backgroundColor: color,
    opacity,
    boxShadow: `0 0 0 2px ${ringColor}`,
  };
}

export function AgentStatusItem({
  agentId,
  label,
  color,
  statusRing,
  badgeProps,
  pendingCount,
  compact = false,
}: AgentStatusItemProps) {
  if (compact) {
    return (
      <div
        className="flex items-center gap-1 px-1"
        role="listitem"
        aria-label={`${label} agent`}
        data-testid={`agent-status-${agentId}`}
      >
        <span className="inline-block rounded-full" style={getDotStyle(statusRing, color, 8)} />
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
      <span className="inline-block rounded-full" style={getDotStyle(statusRing, color, 12)} />
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
