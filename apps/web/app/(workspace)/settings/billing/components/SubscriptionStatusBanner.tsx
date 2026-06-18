import Link from 'next/link';

interface SubscriptionStatusBannerProps {
  /**
   * Workspace's current `subscription_status`. Render-only when the status
   * is one of the pause statuses (`past_due`, `suspended`). All other
   * statuses (including `active`, `free`, `cancelled`, `deleted`) render
   * nothing.
   */
  subscriptionStatus: string;
}

/**
 * Story 9.5b AC5a — SubscriptionStatusBanner (FR60 P0 notify).
 *
 * Server Component (no `'use client'` — pure presentational). Renders on the
 * billing settings page when `subscription_status ∈ {past_due, suspended}`.
 *
 * This is the minimum user-visible surface for FR60's notify clause — it
 * converts a silent agent-execution pause into a discoverable state. The
 * banner links to `/settings/billing` (deep-link to the page where the user
 * can resolve the payment issue).
 *
 * Email/push delivery (AC5b) is deferred to 9-7 / 10-3.
 *
 * NOTE: `cancelled` and `deleted` do NOT render the banner:
 *  - `cancelled` is owner-scheduled cancel-at-period-end (the owner already knows)
 *  - `deleted` is terminal — the user has no reason to land in the workspace.
 */
export function SubscriptionStatusBanner({
  subscriptionStatus,
}: SubscriptionStatusBannerProps) {
  if (subscriptionStatus !== 'past_due' && subscriptionStatus !== 'suspended') {
    return null;
  }

  const isSuspended = subscriptionStatus === 'suspended';
  const heading = isSuspended
    ? 'Your workspace is suspended'
    : 'Payment issue — agents paused';
  const message = isSuspended
    ? 'Agents cannot run while your subscription is suspended. Update your payment method to restore access.'
    : 'Agents are paused while we wait for your payment to process. No data is lost — resolve the payment to resume.';

  return (
    <div
      className="rounded-[var(--flow-radius-md)] border border-red-200 bg-red-50 p-4"
      role="alert"
      data-testid="subscription-status-banner"
      data-status={subscriptionStatus}
    >
      <div className="flex items-start gap-3">
        <svg
          aria-hidden="true"
          className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
            clipRule="evenodd"
          />
        </svg>
        <div className="flex-1">
          <p className="text-sm font-semibold text-red-900">{heading}</p>
          <p className="mt-1 text-sm text-red-800">{message}</p>
          <div className="mt-3">
            <Link
              href="/settings/billing"
              className="inline-flex rounded-[var(--flow-radius-sm)] bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
              data-testid="subscription-status-banner-cta"
            >
              Resolve payment
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
