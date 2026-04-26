'use client';

interface TierLimitBannerProps {
  activeCount: number;
  limit: number;
  tierName?: string;
}

export function TierLimitBanner({ activeCount, limit, tierName = 'Free' }: TierLimitBannerProps) {
  if (limit === -1) return null;
  if (activeCount >= limit * 0.8) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
        {activeCount} of {limit} clients ({tierName} plan)
        {activeCount >= limit && ' — Limit reached. '}
        {activeCount >= limit && (
          <span className="font-medium text-[var(--flow-color-text-brand)]">Upgrade</span>
        )}
      </div>
    );
  }
  return null;
}
