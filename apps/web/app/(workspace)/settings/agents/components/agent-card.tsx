'use client';

import Link from 'next/link';
import { Badge } from '@flow/ui';

const STATUS_DISPLAY: Record<string, { label: string; variant: 'default' | 'secondary' | 'error' | 'outline' | 'success' | 'warning' }> = {
  inactive: { label: 'Inactive', variant: 'secondary' },
  activating: { label: 'Activating', variant: 'outline' },
  active: { label: 'Active', variant: 'success' },
  draining: { label: 'Draining', variant: 'warning' },
  suspended: { label: 'Suspended', variant: 'error' },
};

interface AgentCardProps {
  agentId: string;
  label: string;
  description: string;
  icon: string;
  status?: string;
  setupCompleted?: boolean;
  lifecycleVersion?: number;
}

export function AgentCard({
  agentId,
  label,
  description,
  icon,
  status,
  setupCompleted,
}: AgentCardProps) {
  const resolvedStatus = status ?? 'inactive';
  const display = STATUS_DISPLAY[resolvedStatus] ?? { label: resolvedStatus, variant: 'secondary' as const };
  const isDraft = !setupCompleted && resolvedStatus !== 'active';

  return (
    <Link
      href={`/settings/agents/${agentId}`}
      className="group block rounded-lg border border-[var(--flow-color-border-default)] bg-[var(--flow-bg-surface)] p-4 transition-colors hover:border-[var(--flow-border-strong)] hover:bg-[var(--flow-bg-surface-raised)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: `color-mix(in srgb, var(--flow-agent-${icon}) 15%, transparent)` }}
        >
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: `var(--flow-agent-${icon})` }}
          />
        </div>
        <Badge variant={display.variant}>{display.label}</Badge>
      </div>
      <div className="mt-3">
        <h3 className="text-sm font-medium text-[var(--flow-color-text-primary)] group-hover:text-[var(--flow-accent-primary)]">
          {label}
        </h3>
        <p className="mt-1 text-xs text-[var(--flow-color-text-secondary)] line-clamp-2">
          {description}
        </p>
        {isDraft && (
          <p className="mt-2 text-xs text-[var(--flow-status-warning)]">
            Setup required before activation
          </p>
        )}
      </div>
    </Link>
  );
}
