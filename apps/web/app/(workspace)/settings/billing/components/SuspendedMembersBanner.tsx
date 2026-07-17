import Link from 'next/link';

/**
 * Story 9.5c AC4 — SuspendedMembersBanner (FR57a).
 *
 * Owner-facing banner rendered in DUAL PLACEMENT — both the billing settings
 * page and the team settings page — when the workspace has team members in
 * the `suspended` state (i.e. a prior Agency→Pro downgrade paused the
 * excess). Owners thinking about team aren't always on billing, so the
 * banner must appear on both surfaces (Sally's finding).
 *
 * Server Component (no `'use client'`). The data hook (suspended-member
 * count + latest suspended_at) is done by the host page and passed as props;
 * this component is pure presentational.
 *
 * Copy per AC4: plain language, drops passive voice. Primary CTA "Upgrade to
 * Agency" (triggers Task 8 reactivation — restores all suspended members).
 * Secondary CTA "Manage team" (links to the team settings page; full
 * per-member reactivation UX is owned by story 9-5f per PD4).
 *
 * The banner alone is not enough (Sally): it assumes the owner logs in. The
 * member + owner emails in AC5 are the floor; this banner is the ceiling.
 */
interface SuspendedMembersBannerProps {
  /** Count of workspace_members with status='suspended'. Renders nothing when 0. */
  suspendedCount: number;
  /** Pro plan team-member limit (sourced from getTierConfig — never hardcoded, PD1). */
  proTeamMemberLimit: number;
  /**
   * Placement hint: which surface this banner is mounted on. The secondary
   * CTA ("Manage team") deep-links to the OPPOSITE surface — on billing it
   * links to team settings, on team settings it links to billing. Avoids a
   * dead "you are here" link.
   */
  placement: 'billing' | 'team-settings';
}

export function SuspendedMembersBanner({
  suspendedCount,
  proTeamMemberLimit,
  placement,
}: SuspendedMembersBannerProps) {
  // Render only when there are actually suspended members.
  if (suspendedCount === 0) return null;

  // The secondary CTA points to the OTHER surface.
  const secondaryHref =
    placement === 'billing' ? '/settings/team' : '/settings/billing';
  const secondaryLabel =
    placement === 'billing' ? 'Manage team' : 'Go to billing';

  return (
    <div
      className="rounded-[var(--flow-radius-md)] border border-amber-200 bg-amber-50 p-4"
      role="status"
      data-testid="suspended-members-banner"
      data-placement={placement}
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
            When you downgraded to Pro, we paused {suspendedCount} team
            member{suspendedCount === 1 ? '' : 's'} to fit the Pro limit
            ({proTeamMemberLimit}). They can&apos;t log in but their work is
            preserved.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {/* Primary CTA: upgrade restores all suspended members (Task 8 hook). */}
            <Link
              href="/settings/billing"
              className="inline-flex rounded-[var(--flow-radius-sm)] bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
              data-testid="suspended-members-banner-upgrade"
            >
              Upgrade to Agency
            </Link>
            {/* Secondary CTA: cross-link to the other surface. */}
            <Link
              href={secondaryHref}
              className="text-xs font-medium text-amber-700 underline hover:text-amber-900"
              data-testid="suspended-members-banner-manage"
            >
              {secondaryLabel}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
