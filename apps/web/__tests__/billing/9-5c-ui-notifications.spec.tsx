/**
 * Story 9.5c Tasks 5–7 — UI + notification tests.
 *
 * Covers:
 *  - AgencyDowngradeHeadsup (AC1 Option B): render gating + copy.
 *  - SuspendedMembersBanner (AC4): dual placement, render gating, CTAs.
 *  - SuspendedMemberBanner (AC5 EC10): member-facing banner copy.
 *  - suspension-notifications template builders (AC5): plain copy, no
 *    algorithm-speak, correct attribution.
 *
 * Banners are Server Components (pure presentational) — tested via direct
 * render + DOM assertion (no user interaction).
 *
 * FR57a.
 */
import { describe, test, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';

// Flush React's pending work between tests so scheduler microtasks don't
// fire after the jsdom environment tears down (avoids "window is not
// defined" uncaught-exception noise in test output).
afterEach(() => {
  cleanup();
});
import { AgencyDowngradeHeadsup } from '@/app/(workspace)/settings/billing/components/AgencyDowngradeHeadsup';
import { SuspendedMembersBanner } from '@/app/(workspace)/settings/billing/components/SuspendedMembersBanner';
import { SuspendedMemberBanner } from '@/app/(workspace)/settings/billing/components/SuspendedMemberBanner';
import {
  buildMemberSuspendedEmail,
  buildOwnerSuspendedEmail,
} from '@/lib/actions/billing/suspension-notifications';

// ───────────────────────────────────────────────────────────────
// AC1 (Option B) — AgencyDowngradeHeadsup
// ───────────────────────────────────────────────────────────────
describe('[AC1] AgencyDowngradeHeadsup', () => {
  test('renders when agency tier + over Pro limit', () => {
    const { container } = render(
      <AgencyDowngradeHeadsup
        currentTier="agency"
        activeTeamMemberCount={8}
        proTeamMemberLimit={5}
      />,
    );
    expect(container.querySelector('[data-testid="agency-downgrade-headsup"]')).not.toBeNull();
    expect(container.textContent).toContain('8 team members');
    expect(container.textContent).toContain('Pro supports 5');
    expect(container.textContent).toContain('3 members'); // excess
  });

  test('does NOT render when not agency tier', () => {
    const { container } = render(
      <AgencyDowngradeHeadsup
        currentTier="pro"
        activeTeamMemberCount={8}
        proTeamMemberLimit={5}
      />,
    );
    expect(container.querySelector('[data-testid="agency-downgrade-headsup"]')).toBeNull();
  });

  test('does NOT render when within Pro limit (no excess)', () => {
    const { container } = render(
      <AgencyDowngradeHeadsup
        currentTier="agency"
        activeTeamMemberCount={5}
        proTeamMemberLimit={5}
      />,
    );
    expect(container.querySelector('[data-testid="agency-downgrade-headsup"]')).toBeNull();
  });

  test('uses the proLimit from props (never hardcoded — PD1)', () => {
    const { container } = render(
      <AgencyDowngradeHeadsup
        currentTier="agency"
        activeTeamMemberCount={10}
        proTeamMemberLimit={5}
      />,
    );
    // The copy names the configured limit, not a hardcoded number.
    expect(container.textContent).toContain('Pro supports 5');
  });

  test('plain language: uses "paused" and reassures data is preserved', () => {
    const { container } = render(
      <AgencyDowngradeHeadsup
        currentTier="agency"
        activeTeamMemberCount={7}
        proTeamMemberLimit={5}
      />,
    );
    const text = container.textContent ?? '';
    // "paused" is the chosen human verb (not "suspended"/"revoked").
    expect(text).toMatch(/paused/i);
    // The word "revoked" (the bureaucratic alternative) must not appear.
    expect(text).not.toMatch(/revoked/i);
    // "removed" is allowed ONLY in a negation ("not removed") — the copy
    // explicitly reassures data is preserved. Assert that reassurance.
    expect(text).toMatch(/not removed|preserved/i);
  });
});

// ───────────────────────────────────────────────────────────────
// AC4 — SuspendedMembersBanner (dual placement)
// ───────────────────────────────────────────────────────────────
describe('[AC4] SuspendedMembersBanner', () => {
  test('renders when suspendedCount > 0 (billing placement)', () => {
    const { container } = render(
      <SuspendedMembersBanner
        suspendedCount={3}
        proTeamMemberLimit={5}
        placement="billing"
      />,
    );
    const banner = container.querySelector('[data-testid="suspended-members-banner"]');
    expect(banner).not.toBeNull();
    expect(banner?.getAttribute('data-placement')).toBe('billing');
    expect(container.textContent).toContain('paused 3 team members');
    expect(container.textContent).toContain('Pro limit (5)');
  });

  test('primary CTA is "Upgrade to Agency"', () => {
    const { container } = render(
      <SuspendedMembersBanner
        suspendedCount={2}
        proTeamMemberLimit={5}
        placement="billing"
      />,
    );
    const cta = container.querySelector('[data-testid="suspended-members-banner-upgrade"]');
    expect(cta?.textContent).toBe('Upgrade to Agency');
    expect(cta?.getAttribute('href')).toBe('/settings/billing');
  });

  test('billing placement: secondary CTA links to team settings', () => {
    const { container } = render(
      <SuspendedMembersBanner
        suspendedCount={1}
        proTeamMemberLimit={5}
        placement="billing"
      />,
    );
    const manage = container.querySelector('[data-testid="suspended-members-banner-manage"]');
    expect(manage?.textContent).toBe('Manage team');
    expect(manage?.getAttribute('href')).toBe('/settings/team');
  });

  test('team-settings placement: secondary CTA links back to billing', () => {
    const { container } = render(
      <SuspendedMembersBanner
        suspendedCount={1}
        proTeamMemberLimit={5}
        placement="team-settings"
      />,
    );
    const manage = container.querySelector('[data-testid="suspended-members-banner-manage"]');
    expect(manage?.getAttribute('href')).toBe('/settings/billing');
  });

  test('does NOT render when suspendedCount = 0', () => {
    const { container } = render(
      <SuspendedMembersBanner
        suspendedCount={0}
        proTeamMemberLimit={5}
        placement="billing"
      />,
    );
    expect(container.querySelector('[data-testid="suspended-members-banner"]')).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────
// AC5 (EC10) — SuspendedMemberBanner (member-facing)
// ───────────────────────────────────────────────────────────────
describe('[AC5/EC10] SuspendedMemberBanner', () => {
  test('renders the "your access was paused" copy with workspace name', () => {
    const { container } = render(
      <SuspendedMemberBanner
        suspendedAt="2026-07-17T00:00:00.000Z"
        workspaceName="Acme VA"
      />,
    );
    const banner = container.querySelector('[data-testid="suspended-member-banner"]');
    expect(banner).not.toBeNull();
    expect(banner?.getAttribute('role')).toBe('alert');
    expect(container.textContent).toContain('Acme VA');
    expect(container.textContent).toMatch(/paused/i);
  });

  test('attributes cause to the workspace plan change, not the member (AC5)', () => {
    const { container } = render(
      <SuspendedMemberBanner
        suspendedAt="2026-07-17T00:00:00.000Z"
        workspaceName="Acme VA"
      />,
    );
    const text = container.textContent ?? '';
    // Must mention the plan change as cause.
    expect(text).toMatch(/changed its plan/i);
    // Must NOT use algorithm/role-speak.
    expect(text).not.toMatch(/role priority|seniority|algorithm/i);
  });

  test('mentions data preservation + reactivation recourse (AC3 promise)', () => {
    const { container } = render(
      <SuspendedMemberBanner
        suspendedAt="2026-07-17T00:00:00.000Z"
        workspaceName="Acme VA"
      />,
    );
    const text = container.textContent ?? '';
    expect(text).toMatch(/work isn't deleted|work isn?t deleted/i);
    expect(text).toMatch(/upgrade back|re-added/i);
  });
});

// ───────────────────────────────────────────────────────────────
// AC5 — suspension-notifications template builders
// ───────────────────────────────────────────────────────────────
describe('[AC5] buildMemberSuspendedEmail', () => {
  test('subject + body attribute cause to the workspace plan change', () => {
    const payload = buildMemberSuspendedEmail({
      to: 'member@example.com',
      workspaceName: 'Acme VA',
      ownerEmail: 'owner@acme.com',
      suspendedAt: 'July 17, 2026',
    });
    expect(payload.to).toBe('member@example.com');
    expect(payload.subject).toContain('Acme VA');
    expect(payload.subject).toMatch(/paused/i);
    expect(payload.htmlBody).toContain('changed its plan to Pro');
    expect(payload.htmlBody).toContain('Acme VA');
    expect(payload.htmlBody).toContain('owner@acme.com');
  });

  test('strips algorithm/role-speak from copy (AC5)', () => {
    const payload = buildMemberSuspendedEmail({
      to: 'member@example.com',
      workspaceName: 'Acme VA',
      ownerEmail: 'owner@acme.com',
      suspendedAt: 'July 17, 2026',
    });
    // User-facing copy must not expose the role-priority algorithm.
    expect(payload.htmlBody).not.toMatch(/role priority|seniority|algorithm/i);
    expect(payload.textBody).not.toMatch(/role priority|seniority|algorithm/i);
  });

  test('escapes HTML in workspace name (XSS safety)', () => {
    const payload = buildMemberSuspendedEmail({
      to: 'member@example.com',
      workspaceName: '<script>x</script>',
      ownerEmail: 'o@e.com',
      suspendedAt: 'July 17, 2026',
    });
    expect(payload.htmlBody).not.toContain('<script>');
    expect(payload.htmlBody).toContain('&lt;script&gt;');
  });
});

describe('[AC5] buildOwnerSuspendedEmail', () => {
  test('lists suspended members + both deep links (AC5)', () => {
    const payload = buildOwnerSuspendedEmail({
      to: 'owner@acme.com',
      workspaceName: 'Acme VA',
      suspendedMembers: [
        { email: 'a@x.com', name: 'Alice' },
        { email: 'b@x.com', name: 'Bob' },
      ],
      billingUrl: 'https://app.flow.dev/settings/billing',
      teamUrl: 'https://app.flow.dev/settings/team',
    });
    expect(payload.subject).toContain('2 team members');
    expect(payload.htmlBody).toContain('Alice');
    expect(payload.htmlBody).toContain('Bob');
    expect(payload.htmlBody).toContain('https://app.flow.dev/settings/billing');
    expect(payload.htmlBody).toContain('https://app.flow.dev/settings/team');
    expect(payload.htmlBody).toMatch(/Upgrade back to Agency/i);
  });

  test('count pluralization: 1 member → "1 team member was paused"', () => {
    const payload = buildOwnerSuspendedEmail({
      to: 'owner@acme.com',
      workspaceName: 'Acme VA',
      suspendedMembers: [{ email: 'a@x.com' }],
      billingUrl: 'https://app/settings/billing',
      teamUrl: 'https://app/settings/team',
    });
    expect(payload.subject).toContain('1 team member');
    expect(payload.subject).not.toContain('1 team members');
  });
});
