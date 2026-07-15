/**
 * Story 9.4 ATDD — UsageMeter component rendering (T8.3).
 *
 * Split from `9-4-subscription-tiers-tier-limits.spec.ts` because JSX requires
 * the `.tsx` extension. Covers: amber "Approaching limit" badge at ≥80%,
 * red "At limit" badge at 100%, and "Unlimited" rendering for Agency tier.
 *
 * FR55, FR56.
 */
import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { UsageMeter } from '@/app/(workspace)/settings/billing/components/UsageMeter';
import type { ActionResult } from '@flow/types';

const noopUpgrade = vi.fn(
  (): Promise<ActionResult<{ checkoutUrl: string }>> =>
    Promise.resolve({
      success: true,
      data: { checkoutUrl: 'https://example.com' },
    }),
);

afterEach(() => {
  cleanup();
});

describe('[P0] [9.4-ATDD-UI] UsageMeter renders amber/red badges and Unlimited for Agency', () => {
  test('renders "At limit" red badge when current === limit', () => {
    render(
      <UsageMeter
        tier="free"
        usage={{ clients: 3, teamMembers: 0, agents: 0 }}
        limits={{ maxClients: 3, maxTeamMembers: 1, maxAgents: 2 }}
        upgradeAction={noopUpgrade}
      />,
    );
    // getByText throws if the element is absent — sufficient assertion.
    expect(screen.getByText('At limit')).toBeTruthy();
  });

  test('renders "Approaching limit" amber badge at 80% threshold (Pro, 12/15)', () => {
    render(
      <UsageMeter
        tier="pro"
        usage={{ clients: 12, teamMembers: 0, agents: 0 }}
        limits={{ maxClients: 15, maxTeamMembers: 5, maxAgents: 6 }}
        upgradeAction={noopUpgrade}
      />,
    );
    expect(screen.getByText('Approaching limit')).toBeTruthy();
  });

  test('renders "Unlimited" for Agency tier without badges', () => {
    render(
      <UsageMeter
        tier="agency"
        usage={{ clients: 999, teamMembers: 0, agents: 0 }}
        limits={{
          maxClients: Number.MAX_SAFE_INTEGER,
          maxTeamMembers: Number.MAX_SAFE_INTEGER,
          maxAgents: Number.MAX_SAFE_INTEGER,
        }}
        upgradeAction={noopUpgrade}
      />,
    );
    expect(screen.getAllByText(/Unlimited/).length).toBeGreaterThan(0);
    expect(screen.queryByText('At limit')).toBeNull();
    expect(screen.queryByText('Approaching limit')).toBeNull();
  });
});
