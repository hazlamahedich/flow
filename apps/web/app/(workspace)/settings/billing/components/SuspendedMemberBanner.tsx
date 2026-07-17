/**
 * Story 9.5c AC5 (EC10) — SuspendedMemberBanner (FR57a).
 *
 * Server-rendered banner shown to a user whose membership in the current
 * workspace is `suspended` (e.g. they were excess when the workspace
 * downgraded Agency→Pro). Renders the "in-app toast for the member on next
 * login attempt" notification surface from AC5.
 *
 * Server Component (no `'use client'`). Rendered in the workspace layout,
 * gated on the user's membership status for the active workspace being
 * `'suspended'`. The data hook (status lookup) is done by the layout and
 * passed as a prop; this component is pure presentational.
 *
 * Design choice (2026-07-17): server banner rather than a sonner `toast()`.
 * Sonner's `<Toaster>` is not mounted anywhere in the app today, and a
 * one-off toast that fires once per suspended member is poor ROI for the
 * first mount. The `SubscriptionStatusBanner` precedent (server-rendered,
 * `role="alert"`, already in the layout) is more reliable — no client
 * hydration race, no missed-toast-on-fast-navigate risk.
 *
 * Copy matches AC5: attributes cause to the workspace's plan change, plain
 * language, no role/algorithm-speak.
 */
interface SuspendedMemberBannerProps {
  /** ISO date the membership was suspended (for the "paused on {date}" copy). */
  suspendedAt: string | null;
  /** Workspace display name (for "your access to {workspace}"). */
  workspaceName: string;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function SuspendedMemberBanner({
  suspendedAt,
  workspaceName,
}: SuspendedMemberBannerProps) {
  const dateStr = formatDate(suspendedAt);
  return (
    <div
      className="rounded-[var(--flow-radius-md)] border border-amber-200 bg-amber-50 p-4"
      role="alert"
      data-testid="suspended-member-banner"
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
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
            clipRule="evenodd"
          />
        </svg>
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-900">
            Your access to {workspaceName} was paused
            {dateStr ? ` on ${dateStr}` : ''}.
          </p>
          <p className="mt-1 text-sm text-amber-800">
            {workspaceName} changed its plan and your seat is paused. Your work
            isn&apos;t deleted — if they upgrade back, you&apos;ll be re-added
            automatically. Questions? Contact the workspace owner.
          </p>
        </div>
      </div>
    </div>
  );
}
