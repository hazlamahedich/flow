'use client';

interface TrustMeterProps {
  score: number;
}

export function TrustMeter({ score }: TrustMeterProps) {
  const clamped = Math.max(0, Math.min(1000, score));
  const pct = (clamped / 1000) * 100;

  let color: string;
  if (clamped < 200) {
    color = 'var(--flow-emotion-trust-betrayed)';
  } else if (clamped < 500) {
    color = 'var(--flow-emotion-tension)';
  } else if (clamped < 700) {
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
          aria-valuemax={1000}
          aria-label="Trust score"
        />
      </div>
    </div>
  );
}
