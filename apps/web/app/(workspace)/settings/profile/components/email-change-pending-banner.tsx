'use client';

import { useActionState, useEffect, useState } from 'react';
import type { ActionResult } from '@flow/types';

interface EmailChangePendingBannerProps {
  requestId: string;
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

  if (diff === 0) return 'Expired';
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function isExpired(expiresAt: string): boolean {
  return new Date(expiresAt).getTime() <= Date.now();
}

export function EmailChangePendingBanner({
  requestId,
  newEmail,
  expiresAt,
  cancelAction,
}: EmailChangePendingBannerProps) {
  const [countdown, setCountdown] = useState(() => formatCountdown(expiresAt));
  const [expired, setExpired] = useState(() => isExpired(expiresAt));
  const [state, submitAction, isPending] = useActionState(
    async (prev: ActionResult<void> | null) => cancelAction({ requestId }),
    null,
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const nowExpired = isExpired(expiresAt);
      setExpired(nowExpired);
      setCountdown(formatCountdown(expiresAt));
    }, 60_000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const errorMessage = state && !state.success ? state.error.message : null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-[var(--flow-radius-md)] border p-4 space-y-3 ${
        expired
          ? 'border-[var(--flow-color-border-default)] bg-[var(--flow-color-bg-tertiary)] opacity-60'
          : 'border-[var(--flow-color-border-default)] bg-[var(--flow-color-bg-secondary)]'
      }`}
    >
      <p className="text-sm text-[var(--flow-color-text-primary)]">
        {expired ? (
          <>Email change to <strong>{newEmail}</strong> has expired.</>
        ) : (
          <>Pending change to <strong>{newEmail}</strong> — check your inbox to verify.</>
        )}
      </p>
      {!expired && (
        <p className="text-xs text-[var(--flow-color-text-muted)]">
          Expires in {countdown}
        </p>
      )}

      {errorMessage && (
        <p className="text-sm text-[var(--flow-status-error)]" role="alert">
          {errorMessage}
        </p>
      )}

      {!expired && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => submitAction()}
          className="inline-flex items-center justify-center rounded-[var(--flow-radius-md)] border border-[var(--flow-color-border-default)] px-3 py-1.5 text-sm font-medium text-[var(--flow-color-text-secondary)] hover:bg-[var(--flow-color-bg-tertiary)] disabled:opacity-50"
        >
          {isPending ? 'Cancelling...' : 'Cancel change'}
        </button>
      )}
    </div>
  );
}
