'use client';

import { useState, useEffect } from 'react';
import type { UtilizationState } from '@flow/types';

interface RetainerUtilizationBarProps {
  state: UtilizationState;
  billingPeriodEnd?: string | undefined;
  overageMinutes?: number | undefined;
  clientId?: string | undefined;
}

const TOOLTIP_KEY = 'flow-utilization-tooltip-dismissed';

function UtilizationTooltip({ clientId }: { clientId: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const key = `${TOOLTIP_KEY}-${clientId}`;
    if (!localStorage.getItem(key)) {
      setVisible(true);
    }
  }, [clientId]);

  if (!visible) return null;

  return (
    <div className="mt-2 flex items-start gap-2 rounded-md border border-[var(--flow-color-border-default)] bg-[var(--flow-color-bg-surface-raised)] p-3 text-xs text-[var(--flow-color-text-secondary)]">
      <span>
        This bar shows how much of your retainer allocation has been used this billing period.
        Green means on track, amber means approaching threshold, and red means it&apos;s time to renegotiate.
      </span>
      <button
        type="button"
        onClick={() => {
          setVisible(false);
          localStorage.setItem(`${TOOLTIP_KEY}-${clientId}`, 'true');
        }}
        className="shrink-0 text-[var(--flow-color-text-tertiary)] hover:text-[var(--flow-color-text-primary)]"
        aria-label="Dismiss tooltip"
      >
        ✕
      </button>
    </div>
  );
}

const STATUS_ICONS: Record<string, string> = {
  green: '●',
  amber: '◐',
  red: '◆',
};

export function RetainerUtilizationBar({ state, billingPeriodEnd, overageMinutes, clientId }: RetainerUtilizationBarProps) {
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
  const barClass = color === 'green'
    ? 'bg-[var(--flow-status-success)]'
    : color === 'amber'
      ? 'bg-[var(--flow-status-warning)]'
      : 'bg-[var(--flow-status-error)]';
  const textClass = color === 'green'
    ? 'text-[var(--flow-status-success)]'
    : color === 'amber'
      ? 'text-[var(--flow-status-warning)]'
      : 'text-[var(--flow-status-error)]';
  const icon = color === 'green' ? '●' : color === 'amber' ? '◐' : '◆';

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
        <span className="flex items-center gap-1.5 font-medium text-[var(--flow-color-text-primary)]">
          <span className={textClass} aria-hidden="true">{icon}</span>
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
          className={`h-full rounded-full transition-all ${barClass}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <div className="mt-1 flex items-center justify-between">
        {periodText && (
          <p className="text-xs text-[var(--flow-color-text-secondary)]">{periodText}</p>
        )}
        {percent >= 90 && (
          <a
            href="#retainer-panel"
            className="text-xs font-medium text-[var(--flow-accent-primary)] underline"
          >
            Review retainer →
          </a>
        )}
      </div>
      {clientId && (
        <UtilizationTooltip clientId={clientId} />
      )}
    </div>
  );
}
