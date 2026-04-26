'use client';

interface RetainerScopeBannerProps {
  clientName: string;
  utilizationPercent: number;
}

export function RetainerScopeBanner({ clientName, utilizationPercent }: RetainerScopeBannerProps) {
  return (
    <div className="rounded-lg border border-[var(--flow-status-warning)] bg-[var(--flow-status-warning)]/10 px-4 py-3 text-sm">
      <span className="font-medium text-[var(--flow-color-text-primary)]">
        {clientName}&apos;s retainer is at {utilizationPercent}% utilization.
      </span>
      <span className="ml-1 text-[var(--flow-color-text-secondary)]">
        Review scope and consider renegotiating.{' '}
        <a href="#retainer-panel" className="text-[var(--flow-accent-primary)] underline">View retainer</a>
      </span>
    </div>
  );
}
