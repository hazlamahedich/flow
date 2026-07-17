/**
 * Story 9.5c AC1 (Option B scope) — AgencyDowngradeHeadsup (FR57a).
 *
 * Progressive-disclosure, concierge-style heads-up rendered on the billing
 * settings page when the workspace is on `agency` and has more active team
 * members than the Pro plan allows. Surfaces the overage BEFORE the owner
 * downgrades (via Stripe Customer Portal), so they go in with eyes open.
 *
 * Server Component (no `'use client'` — pure presentational). Reads the
 * Pro limit from props (sourced from `getTierConfig().tierLimits.pro
 * .maxTeamMembers` by the page — never hardcoded, per PD1).
 *
 * Scope note (2026-07-17): the full in-app guided-choice flow (choice modal,
 * pre-selected member list, `changeTierAction` direction branching) is deferred
 * to story 9-5d, which is explicitly scoped to own the choice-UI pattern for
 * both clients and team members (symmetry commitment). This heads-up is the
 * proactive UX floor; the webhook path (Task 4) makes the workspace compliant
 * the instant a downgrade lands regardless of how it was triggered.
 */
interface AgencyDowngradeHeadsupProps {
  /** Current workspace tier — banner renders only when === 'agency'. */
  currentTier: string;
  /** Count of active team members (status='active', not expired). */
  activeTeamMemberCount: number;
  /**
   * Pro plan team-member limit, sourced from `getTierConfig()` by the page.
   * Passed as a prop so this component never hardcodes the number (PD1).
   */
  proTeamMemberLimit: number;
}

export function AgencyDowngradeHeadsup({
  currentTier,
  activeTeamMemberCount,
  proTeamMemberLimit,
}: AgencyDowngradeHeadsupProps) {
  // Only render for the at-risk population: Agency workspaces over the Pro
  // limit. Within-limit Agency workspaces, and all other tiers, render nothing.
  if (currentTier !== 'agency') return null;
  if (activeTeamMemberCount <= proTeamMemberLimit) return null;

  const excess = activeTeamMemberCount - proTeamMemberLimit;

  return (
    <div
      className="rounded-[var(--flow-radius-md)] border border-amber-200 bg-amber-50 p-4"
      role="status"
      data-testid="agency-downgrade-headsup"
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
            Heads up — you have {activeTeamMemberCount} team member
            {activeTeamMemberCount === 1 ? '' : 's'}; Pro supports{' '}
            {proTeamMemberLimit}.
          </p>
          <p className="mt-1 text-xs text-amber-800">
            If you switch to Pro, {excess} member
            {excess === 1 ? '' : 's'} will be paused (not removed — their work
            is preserved). You can adjust who stays after the switch, or upgrade
            back any time to restore everyone.
          </p>
        </div>
      </div>
    </div>
  );
}
