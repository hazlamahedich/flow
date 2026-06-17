'use client';

import { useEffect, useState } from 'react';
import type { ActionResult } from '@flow/types';

interface SyncBannerProps {
  isSyncRequested: boolean;
  isCancelReturn: boolean;
  sessionId: string | undefined;
  onSync: (input: { sessionId?: string }) => Promise<ActionResult<{ synced: true }>>;
}

/**
 * Success-redirect / cancellation-return banner.
 *
 * When the user lands back on `/settings/billing?sync=1&session_id=...`
 * (the Stripe Checkout success URL), the banner fires `syncStripeDataAction`
 * once on mount (AC4 — split-brain recovery) and shows an optimistic
 * "synced" message. When the user bails out via the cancel URL
 * (`?status=cancel`), an informational banner is shown instead.
 */
export function SyncBanner({ isSyncRequested, isCancelReturn, sessionId, onSync }: SyncBannerProps) {
  const [synced, setSynced] = useState(false);
  const [syncError, setSyncError] = useState(false);

  useEffect(() => {
    if (!isSyncRequested || synced) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await onSync(sessionId ? { sessionId } : {});
        if (!cancelled) {
          if (result.success) setSynced(true);
          else setSyncError(true);
        }
      } catch {
        if (!cancelled) setSyncError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSyncRequested, synced, sessionId, onSync]);

  if (isCancelReturn) {
    return (
      <div
        className="rounded-[var(--flow-radius-md)] border border-[var(--flow-color-border-default)] bg-[var(--flow-color-bg-secondary)] p-3 text-sm text-[var(--flow-color-text-secondary)]"
        role="status"
      >
        Checkout was cancelled. Your subscription was not changed.
      </div>
    );
  }

  if (isSyncRequested) {
    if (syncError) {
      return (
        <div
          className="rounded-[var(--flow-radius-md)] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
          role="status"
        >
          We could not sync your billing status right now. Your subscription will update shortly.
        </div>
      );
    }
    if (synced) {
      return (
        <div
          className="rounded-[var(--flow-radius-md)] border border-green-200 bg-green-50 p-3 text-sm text-green-800"
          role="status"
        >
          Thanks! Your subscription is being confirmed.
        </div>
      );
    }
    return (
      <div
        className="rounded-[var(--flow-radius-md)] border border-[var(--flow-color-border-default)] bg-[var(--flow-color-bg-secondary)] p-3 text-sm text-[var(--flow-color-text-secondary)]"
        role="status"
      >
        Confirming your subscription…
      </div>
    );
  }

  return null;
}
