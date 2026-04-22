'use client';

import { useActionState, useEffect, useState } from 'react';
import type { ActionResult } from '@flow/types';

interface EmailChangePendingBannerProps {
  newEmail: string;
  expiresAt: string;
  cancelAction: (input: unknown) => Promise<ActionResult<void>>;
}

function formatCountdown(expiresAt: string): string {
  const expires = new Date(expiresAt).getTime();
  const now = Date.now();
  const diff = Math.max(0, expires - now);

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function EmailChangePendingBanner({
  newEmail,
  expiresAt,
  cancelAction,
}: EmailChangePendingBannerProps) {
  const [countdown, setCountdown] = useState(() => formatCountdown(expiresAt));
  const [state, submitAction, isPending] = useActionState(
    async (prev: ActionResult<void> | null) => cancelAction(null),
    null,
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(formatCountdown(expiresAt));
    }, 60_000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const errorMessage = state && !state.success ? state.error.message : null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-[var(--flow-radius-md)] border border-[var(--flow-color-border-default)] bg-[var(--flow-color-bg-secondary)] p-4 space-y-3"
    >
      <p className="text-sm text-[var(--flow-color-text-primary)]">
        Pending change to <strong>{newEmail}</strong> — check your inbox to verify.
      </p>
      <p className="text-xs text-[var(--flow-color-text-muted)]">
        Expires in {countdown}
      </p>

      {errorMessage && (
        <p className="text-sm text-[var(--flow-status-error)]" role="alert">
          {errorMessage}
        </p>
      )}

      <button
        type="button"
        disabled={isPending}
        onClick={() => submitAction()}
        className="inline-flex items-center justify-center rounded-[var(--flow-radius-md)] border border-[var(--flow-color-border-default)] px-3 py-1.5 text-sm font-medium text-[var(--flow-color-text-secondary)] hover:bg-[var(--flow-color-bg-tertiary)] disabled:opacity-50"
      >
        {isPending ? 'Cancelling...' : 'Cancel change'}
      </button>
    </div>
  );
}
