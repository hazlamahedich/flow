'use client';

import { CONFIRM_THRESHOLD_SCORE as CONFIRM_THRESHOLD, AUTO_THRESHOLD_SCORE as AUTO_THRESHOLD } from '@flow/trust';

interface TrustMeterProps {
  score: number;
}

const MAX_SCORE = 200;

export function TrustMeter({ score }: TrustMeterProps) {
  const clamped = Math.max(0, Math.min(MAX_SCORE, score));
  const pct = (clamped / MAX_SCORE) * 100;

  let color: string;
  if (clamped < CONFIRM_THRESHOLD) {
    color = 'var(--flow-emotion-trust-betrayed)';
  } else if (clamped < AUTO_THRESHOLD) {
    color = 'var(--flow-emotion-trust-building)';
  } else {
    color = 'var(--flow-emotion-trust-auto)';
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--flow-text-secondary)]">Trust Score</span>
        <span className="text-xs font-mono text-[var(--flow-text-primary)]">{clamped}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--flow-bg-surface-raised)]">
        <div
          className="h-full rounded-full transition-all duration-[var(--flow-duration-normal)]"
          style={{ width: `${pct}%`, backgroundColor: color }}
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={MAX_SCORE}
          aria-label="Trust score"
        />
      </div>
    </div>
  );
}
