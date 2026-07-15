'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import type { ActionResult } from '@flow/types';

interface DowngradeBannerProps {
  /** Number of clients archived by the most recent downgrade event. */
  archivedCount: number;
  /** ISO timestamp (or null) of the latest archive event. */
  archivedAt: string | null;
  /** Workspace ID — used to namespace localStorage dismiss state. */
  workspaceId: string;
  /** Server Action that initiates a Pro checkout (9-3b). */
  onUpgrade: (input: {
    tier: 'pro';
    interval: 'monthly';
  }) => Promise<ActionResult<{ checkoutUrl: string }>>;
}

const DISMISS_KEY_PREFIX = 'flow:downgrade-banner:dismissed:';
const UPGRADE_PROMPT = (n: number) =>
  `You have ${n} archived ${n === 1 ? 'client' : 'clients'} from your previous plan`;

/**
 * Story 9.5b AC4 — DowngradeBanner (FR57 auto-upgrade prompt).
 *
 * Rendered on the billing settings page when `archivedCount > 0`. Surfaces
 * the existence of archived clients + a primary CTA to upgrade to Pro
 * (restores write access) + a secondary link to view archived clients.
 *
 * Dismiss semantics: hides until a NEW archive event occurs. We store the
 * `archivedAt` timestamp of the last-dismissed event in `localStorage`
 * (per-workspace). When a new event arrives with a later timestamp, the
 * banner re-appears (NOT "reappears every load" — that made dismiss a
 * placebo per Mary's review).
 *
 * EC7: archived clients list at `/clients?status=archived` shows a
 * read-only badge (UX owned by 9-5d; this link is the MVP surface).
 */
export function DowngradeBanner({
  archivedCount,
  archivedAt,
  workspaceId,
  onUpgrade,
}: DowngradeBannerProps) {
  const [dismissedAt, setDismissedAt] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

  // Hydrate dismiss state from localStorage on mount.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(
        DISMISS_KEY_PREFIX + workspaceId,
      );
      setDismissedAt(stored);
    } catch {
      // localStorage may be unavailable (private mode) — non-fatal.
      setDismissedAt(null);
    }
  }, [workspaceId]);

  // Don't render when there's nothing archived, when no archive timestamp
  // is available, OR when the user has dismissed THIS archive event
  // (same-or-newer timestamp).
  if (archivedCount === 0 || !archivedAt) return null;
  if (dismissedAt && dismissedAt >= archivedAt) return null;

  function handleDismiss() {
    if (!archivedAt) return;
    try {
      window.localStorage.setItem(DISMISS_KEY_PREFIX + workspaceId, archivedAt);
    } catch {
      // non-fatal — banner will reappear next load (acceptable degradation)
    }
    setDismissedAt(archivedAt);
  }

  function handleUpgrade() {
    setUpgradeError(null);
    startTransition(async () => {
      try {
        const result = await onUpgrade({ tier: 'pro', interval: 'monthly' });
        if (!result.success) {
          setUpgradeError(result.error.message);
          return;
        }
        // Redirect to Stripe Checkout URL.
        const url = result.data.checkoutUrl;
        if (url) {
          window.location.href = url;
        } else {
          setUpgradeError('Unable to start checkout. Please try again.');
        }
      } catch {
        setUpgradeError('Unable to start checkout. Please try again.');
      }
    });
  }

  return (
    <div
      className="rounded-[var(--flow-radius-md)] border border-amber-200 bg-amber-50 p-4"
      role="status"
      data-testid="downgrade-banner"
    >
      <div className="flex items-start gap-3">
        <svg
          aria-hidden="true"
          className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-900">
            {UPGRADE_PROMPT(archivedCount)}
          </p>
          <p className="mt-1 text-xs text-amber-800">
            Archived clients are read-only. Upgrade to Pro to edit all clients.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleUpgrade}
              disabled={pending}
              className="rounded-[var(--flow-radius-sm)] bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
              data-testid="downgrade-banner-upgrade"
            >
              {pending ? 'Redirecting…' : 'Upgrade to Pro'}
            </button>
            <Link
              href="/clients?status=archived"
              className="text-xs font-medium text-amber-700 underline hover:text-amber-900"
              data-testid="downgrade-banner-view-archived"
            >
              View archived clients
            </Link>
            <button
              type="button"
              onClick={handleDismiss}
              className="text-xs text-amber-600 hover:text-amber-800"
              data-testid="downgrade-banner-dismiss"
              aria-label="Dismiss banner"
            >
              Dismiss
            </button>
          </div>
          {upgradeError && (
            <p className="mt-2 text-xs text-red-700" role="alert">
              {upgradeError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
