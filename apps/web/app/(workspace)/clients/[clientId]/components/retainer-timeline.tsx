'use client';

import type { Retainer } from '@flow/types';
import { formatCentsToDollar } from '@flow/shared';

interface RetainerTimelineProps {
  retainers: readonly Retainer[];
}

function statusLabel(status: string): string {
  return status === 'cancelled' ? 'Cancelled' : status === 'expired' ? 'Expired' : status;
}

function statusColor(status: string): string {
  if (status === 'active') return 'text-[var(--flow-status-success)]';
  if (status === 'cancelled') return 'text-[var(--flow-status-error)]';
  return 'text-[var(--flow-color-text-tertiary)]';
}

function formatPeriod(retainer: Retainer): string {
  if (!retainer.startDate) return '';
  const start = new Date(retainer.startDate + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  if (!retainer.endDate) return `From ${start}`;
  const end = new Date(retainer.endDate + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  return `${start} — ${end}`;
}

function RetainerTimelineItem({ retainer }: { retainer: Retainer }) {
  let detail = '';
  if (retainer.type === 'hourly_rate' && retainer.hourlyRateCents != null) {
    detail = `$${formatCentsToDollar(retainer.hourlyRateCents)}/hr`;
  } else if (retainer.type === 'flat_monthly' && retainer.monthlyFeeCents != null) {
    detail = `$${formatCentsToDollar(retainer.monthlyFeeCents)}/mo`;
  } else if (retainer.type === 'package_based' && retainer.packageHours) {
    detail = `${retainer.packageHours}h package`;
  }

  return (
    <div className="relative flex gap-3 pb-4 last:pb-0">
      <div className="flex flex-col items-center">
        <div className="h-2 w-2 rounded-full bg-[var(--flow-color-border-default)] mt-1.5" />
        <div className="w-px flex-1 bg-[var(--flow-color-border-default)]" />
      </div>
      <div className="min-w-0 flex-1 pb-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="capitalize font-medium text-[var(--flow-color-text-primary)]">
            {retainer.type.replace('_', ' ')}
          </span>
          <span className={`text-xs ${statusColor(retainer.status)}`}>
            {statusLabel(retainer.status)}
          </span>
        </div>
        <p className="text-xs text-[var(--flow-color-text-secondary)]">
          {formatPeriod(retainer)}
          {detail && ` · ${detail}`}
        </p>
        {retainer.cancellationReason && (
          <p className="mt-1 text-xs text-[var(--flow-color-text-tertiary)]">
            Reason: {retainer.cancellationReason}
          </p>
        )}
      </div>
    </div>
  );
}

export function RetainerTimeline({ retainers }: RetainerTimelineProps) {
  if (retainers.length === 0) return null;

  return (
    <div className="mt-4">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--flow-color-text-tertiary)]">
        Retainer History
      </h4>
      <div>
        {retainers.map((r) => (
          <RetainerTimelineItem key={r.id} retainer={r} />
        ))}
      </div>
    </div>
  );
}
