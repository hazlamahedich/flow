'use client';

import type { UtilizationState } from '@flow/types';

interface RetainerUtilizationBarProps {
  state: UtilizationState;
  billingPeriodEnd?: string | undefined;
  overageMinutes?: number | undefined;
}

export function RetainerUtilizationBar({ state, billingPeriodEnd, overageMinutes }: RetainerUtilizationBarProps) {
  if (state.type === 'informational') {
    const hours = (state.hoursTracked / 60).toFixed(1);
    return (
      <p className="text-sm text-[var(--flow-color-text-secondary)]">
        {hours} hours tracked this period
      </p>
    );
  }

  if (state.type === 'no_threshold') {
    return (
      <p className="text-sm text-[var(--flow-color-text-secondary)]">
        {state.message}
      </p>
    );
  }

  const { percent, label, color } = state;
  const barWidth = Math.min(percent, 100);
  const colorClass = {
    green: 'bg-[var(--flow-status-success)]',
    amber: 'bg-[var(--flow-status-warning)]',
    red: 'bg-[var(--flow-status-error)]',
  }[color];

  let periodText = '';
  if (billingPeriodEnd) {
    const end = new Date(billingPeriodEnd + 'T00:00:00Z');
    const now = new Date();
    const daysLeft = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const periodDate = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    periodText = `Billing period resets in ${daysLeft} days (${periodDate}).`;
  }

  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-[var(--flow-color-text-primary)]">
          {percent}% — {label}
        </span>
        {percent > 100 && overageMinutes != null && overageMinutes > 0 && (
          <span className="text-xs font-medium text-[var(--flow-status-error)]">
            {Math.round(overageMinutes / 60 * 10) / 10}h over threshold
          </span>
        )}
      </div>
      <div
        role="progressbar"
        aria-valuenow={Math.min(percent, 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${percent}% utilized, ${label}`}
        className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[var(--flow-bg-surface-raised)]"
      >
        <div
          className={`h-full rounded-full transition-all ${colorClass}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      {periodText && (
        <p className="mt-1 text-xs text-[var(--flow-color-text-secondary)]">{periodText}</p>
      )}
    </div>
  );
}
