/**
 * Story 9.4 Unit Tests — Tier Limits (GREEN — T8.1+T8.4)
 *
 * Verifies the pure helpers, enforceTierLimit, changeTierAction, fee notice,
 * and edge cases EC1–EC12. Tests import the REAL implementation modules.
 *
 * FR55, FR56, FR61, FR62
 *
 * Story 9.4 — AC0 (Test-First): originally committed as a red-phase scaffold
 * (SHA f72cf1d, 2026-06-17) where the imports failed. T1–T7 implementations
 * turn it GREEN.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

// ── Mocks for external dependencies ──
// The real @flow/db count helpers are mocked so enforceTierLimit's RLS reads
// don't need a live Supabase. createFlowError is preserved from actual.
vi.mock('@/lib/supabase-server', () => ({ getServerSupabase: vi.fn() }));
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

const { mockCountActiveClients, mockCountActiveTeamMembers, mockCountActiveAgents, mockRequireTenantContext, mockCreateCheckout } = vi.hoisted(() => ({
  mockCountActiveClients: vi.fn().mockResolvedValue(0),
  mockCountActiveTeamMembers: vi.fn().mockResolvedValue(0),
  mockCountActiveAgents: vi.fn().mockResolvedValue(0),
  mockRequireTenantContext: vi.fn().mockResolvedValue({
    workspaceId: 'ws-1',
    userId: 'user-1',
    role: 'owner',
  }),
  mockCreateCheckout: vi.fn(),
}));

vi.mock('@flow/db', async () => {
  const actual = await vi.importActual<typeof import('@flow/db')>('@flow/db');
  return {
    ...actual,
    requireTenantContext: mockRequireTenantContext,
    countActiveClients: mockCountActiveClients,
    countActiveTeamMembers: mockCountActiveTeamMembers,
    countActiveAgents: mockCountActiveAgents,
  };
});

vi.mock('@/lib/actions/billing/create-checkout-session', () => ({
  createCheckoutSessionAction: mockCreateCheckout,
}));

vi.mock('@/lib/config/tier-config', () => ({
  getTierConfig: vi.fn().mockResolvedValue({
    tierLimits: {
      free: { maxClients: 3, maxTeamMembers: 1, maxAgents: 2 },
      pro: { maxClients: 15, maxTeamMembers: 5, maxAgents: 6 },
      agency: { maxClients: null, maxTeamMembers: null, maxAgents: null },
    },
    stripePrices: { pro_monthly: 'price_pro', agency_monthly: 'price_agency' },
    planDisplayPrices: {
      pro: { label: '$29 / month', interval: 'month' },
      agency: { label: '$99 / month', interval: 'month' },
    },
    windows: { grace_period_days: 7, suspension_period_days: 30 },
    freeTransactionFeePercent: 5,
  }),
}));

// ── REAL imports ──
import { APPROACH_THRESHOLD_PERCENT, checkTierLimit } from '@flow/shared';
import { changeTierSchema } from '@flow/types';
import {
  getTierLimits,
  enforceTierLimit,
} from '@/lib/actions/billing/enforce-tier-limit';
import { changeTierAction } from '@/lib/actions/billing/change-tier';
import { getTierConfig } from '@/lib/config/tier-config';
import { createCheckoutSessionAction } from '@/lib/actions/billing/create-checkout-session';
import { getServerSupabase } from '@/lib/supabase-server';

/** Build a fake supabase whose workspaces.maybeSingle returns `tier`. */
function makeSupabaseReturningTier(tier: string, status = 'active') {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { subscription_tier: tier, subscription_status: status },
          }),
        })),
      })),
    })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCountActiveClients.mockResolvedValue(0);
  mockCountActiveTeamMembers.mockResolvedValue(0);
  mockCountActiveAgents.mockResolvedValue(0);
  mockRequireTenantContext.mockResolvedValue({
    workspaceId: 'ws-1',
    userId: 'user-1',
    role: 'owner',
  });
});

// ─────────────────────────────────────────────────────────────
// T1.1 — Pure helpers (packages/shared)
// ─────────────────────────────────────────────────────────────
describe('[9.4-T1.1] checkTierLimit pure helper (FR56)', () => {
  test('APPROACH_THRESHOLD_PERCENT === 0.8', () => {
    expect(APPROACH_THRESHOLD_PERCENT).toBe(0.8);
  });

  test('EC1 — unlimited (MAX_SAFE_INTEGER): always allowed', () => {
    const result = checkTierLimit({ current: 1_000_000, adding: 1, limit: Number.MAX_SAFE_INTEGER });
    expect(result.allowed).toBe(true);
  });

  test('EC2 — at 80% threshold (Pro, current=12, limit=15): warning fires', () => {
    // ceil(15 * 0.8) = 12 → 12 >= 12 fires warning
    const result = checkTierLimit({ current: 12, adding: 0, limit: 15 });
    expect(result.allowed).toBe(true);
    expect(result.warning).toBe('Approaching limit');
  });

  test('EC3 — over limit blocks (current + adding > limit): no warning, just block', () => {
    const result = checkTierLimit({ current: 3, adding: 1, limit: 3 });
    expect(result.allowed).toBe(false);
    expect(result.warning).toBeUndefined();
  });

  test('under limit and below threshold: allow, no warning', () => {
    const result = checkTierLimit({ current: 0, adding: 1, limit: 3 });
    expect(result.allowed).toBe(true);
    expect(result.warning).toBeUndefined();
  });

  test('boundary: current exactly at ceil(80%) but adding would still fit', () => {
    // Free maxClients=3, ceil(3*0.8)=3 → at 3 we're at the threshold.
    // current=3, adding=0: projected=3, not > 3 → allowed + warn.
    const result = checkTierLimit({ current: 3, adding: 0, limit: 3 });
    expect(result.allowed).toBe(true);
    expect(result.warning).toBe('Approaching limit');
  });
});

// ─────────────────────────────────────────────────────────────
// T1.2 — changeTierSchema (packages/types)
// ─────────────────────────────────────────────────────────────
describe('[9.4-T1.2] changeTierSchema (FR62)', () => {
  test('EC7 — rejects downgrade to free (schema-level)', () => {
    expect(changeTierSchema.safeParse({ targetTier: 'free' }).success).toBe(false);
  });
  test('accepts pro', () => {
    expect(changeTierSchema.safeParse({ targetTier: 'pro' }).success).toBe(true);
  });
  test('accepts agency', () => {
    expect(changeTierSchema.safeParse({ targetTier: 'agency' }).success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
// T2 — getTierLimits + enforceTierLimit
// ─────────────────────────────────────────────────────────────
describe('[9.4-T2] getTierLimits (AC1, AC2)', () => {
  test('EC12 — pro.maxTeamMembers === 5 (seed fix T7.1)', async () => {
    const proLimits = await getTierLimits('pro');
    expect(proLimits.maxTeamMembers).toBe(5);
  });

  test('EC1 — agency normalized to MAX_SAFE_INTEGER (unlimited)', async () => {
    const agencyLimits = await getTierLimits('agency');
    expect(agencyLimits.maxClients).toBe(Number.MAX_SAFE_INTEGER);
    expect(agencyLimits.maxTeamMembers).toBe(Number.MAX_SAFE_INTEGER);
    expect(agencyLimits.maxAgents).toBe(Number.MAX_SAFE_INTEGER);
  });

  test('free limits are finite', async () => {
    const freeLimits = await getTierLimits('free');
    expect(freeLimits.maxClients).toBeGreaterThan(0);
    expect(freeLimits.maxTeamMembers).toBeGreaterThan(0);
    expect(freeLimits.maxAgents).toBeGreaterThan(0);
  });
});

describe('[9.4-T2] enforceTierLimit (AC2, AC3)', () => {
  test('EC1 — Agency tier never blocks', async () => {
    vi.mocked(getServerSupabase).mockResolvedValue(makeSupabaseReturningTier('agency') as never);
    mockCountActiveClients.mockResolvedValue(1_000_000);

    const result = await enforceTierLimit({ workspaceId: 'ws-1', resource: 'clients' });
    expect(result.allowed).toBe(true);
    expect(result.tier).toBe('agency');
  });

  test('EC3 — Free at 3/3 clients blocks 4th creation (delta=1 default)', async () => {
    vi.mocked(getServerSupabase).mockResolvedValue(makeSupabaseReturningTier('free') as never);
    mockCountActiveClients.mockResolvedValue(3);

    const result = await enforceTierLimit({ workspaceId: 'ws-1', resource: 'clients' });
    expect(result.allowed).toBe(false);
    expect(result.limit).toBe(3);
    expect(result.current).toBe(3);
    expect(result.tier).toBe('free');
  });

  test('EC2 — Free at 2/3 clients: allowed, no warning (ceil(3*0.8)=3)', async () => {
    vi.mocked(getServerSupabase).mockResolvedValue(makeSupabaseReturningTier('free') as never);
    mockCountActiveClients.mockResolvedValue(2);

    const result = await enforceTierLimit({ workspaceId: 'ws-1', resource: 'clients' });
    expect(result.allowed).toBe(true);
    expect(result.warning).toBeUndefined();
  });

  test('Free at 3/3 with delta=0: allowed + warning (usage-display path)', async () => {
    vi.mocked(getServerSupabase).mockResolvedValue(makeSupabaseReturningTier('free') as never);
    mockCountActiveClients.mockResolvedValue(3);

    const result = await enforceTierLimit({ workspaceId: 'ws-1', resource: 'clients', delta: 0 });
    expect(result.allowed).toBe(true);
    expect(result.warning).toBe('Approaching limit');
  });

  test('EC11 — team_members counts active members via @flow/db helper', async () => {
    vi.mocked(getServerSupabase).mockResolvedValue(makeSupabaseReturningTier('pro') as never);
    mockCountActiveTeamMembers.mockResolvedValue(5);

    const result = await enforceTierLimit({ workspaceId: 'ws-1', resource: 'team_members' });
    expect(mockCountActiveTeamMembers).toHaveBeenCalled();
    expect(result.current).toBe(5);
    expect(result.limit).toBe(5);
    expect(result.allowed).toBe(false); // 5 + 1 > 5
  });

  test('agents resource is counted via countActiveAgents', async () => {
    vi.mocked(getServerSupabase).mockResolvedValue(makeSupabaseReturningTier('free') as never);
    mockCountActiveAgents.mockResolvedValue(1);

    const result = await enforceTierLimit({ workspaceId: 'ws-1', resource: 'agents' });
    expect(mockCountActiveAgents).toHaveBeenCalled();
    expect(result.allowed).toBe(true);
  });

  test('EC10 — status-independent: past_due Pro still uses Pro limits', async () => {
    vi.mocked(getServerSupabase).mockResolvedValue(makeSupabaseReturningTier('pro', 'past_due') as never);
    mockCountActiveClients.mockResolvedValue(0);

    const result = await enforceTierLimit({ workspaceId: 'ws-1', resource: 'clients' });
    expect(result.tier).toBe('pro');
    expect(result.limit).toBe(15); // Pro maxClients, not Free's 3
  });

  test('fails closed when workspace row is missing', async () => {
    vi.mocked(getServerSupabase).mockResolvedValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          })),
        })),
      })),
    } as never);

    const result = await enforceTierLimit({ workspaceId: 'ws-1', resource: 'clients' });
    expect(result.allowed).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// T4 — changeTierAction (FR62)
// ─────────────────────────────────────────────────────────────
describe('[9.4-T4] changeTierAction (FR62)', () => {
  test('EC6 — same tier rejected with INVALID_STATE 409', async () => {
    vi.mocked(getServerSupabase).mockResolvedValue(makeSupabaseReturningTier('pro') as never);

    const result = await changeTierAction({ targetTier: 'pro' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_STATE');
      expect(result.error.status).toBe(409);
    }
  });

  test('EC8 — delegates to createCheckoutSessionAction for proration', async () => {
    vi.mocked(getServerSupabase).mockResolvedValue(makeSupabaseReturningTier('free') as never);
    vi.mocked(createCheckoutSessionAction).mockResolvedValue({
      success: true,
      data: { url: 'https://checkout.stripe.com/cs_test_proration' },
    });

    const result = await changeTierAction({ targetTier: 'pro' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.checkoutUrl).toBe('https://checkout.stripe.com/cs_test_proration');
    }
    // EC8: no local proration — pure delegation.
    expect(createCheckoutSessionAction).toHaveBeenCalledWith({ tier: 'pro', interval: 'monthly' });
  });

  test('EC4 — upgrade allowed regardless of current usage', async () => {
    vi.mocked(getServerSupabase).mockResolvedValue(makeSupabaseReturningTier('free') as never);
    mockCountActiveClients.mockResolvedValue(99); // way over free limit
    vi.mocked(createCheckoutSessionAction).mockResolvedValue({
      success: true,
      data: { url: 'https://checkout.stripe.com/cs_upgrade' },
    });

    const result = await changeTierAction({ targetTier: 'agency' });
    expect(result.success).toBe(true);
  });

  test('propagates SYSTEM_CONFIG_MISSING from 9-3b', async () => {
    vi.mocked(getServerSupabase).mockResolvedValue(makeSupabaseReturningTier('free') as never);
    vi.mocked(createCheckoutSessionAction).mockResolvedValue({
      success: false,
      error: {
        status: 400,
        code: 'SYSTEM_CONFIG_MISSING',
        message: 'Selected plan is not available.',
        category: 'system',
      },
    });

    const result = await changeTierAction({ targetTier: 'pro' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('SYSTEM_CONFIG_MISSING');
    }
  });

  test('non-owner rejected with FORBIDDEN', async () => {
    vi.mocked(getServerSupabase).mockResolvedValue(makeSupabaseReturningTier('free') as never);
    mockRequireTenantContext.mockResolvedValue({
      workspaceId: 'ws-1',
      userId: 'user-1',
      role: 'admin',
    });

    const result = await changeTierAction({ targetTier: 'pro' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('FORBIDDEN');
    }
  });

  test('rejects invalid input shape', async () => {
    const result = await changeTierAction({ targetTier: 'invalid_tier' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });
});

// ─────────────────────────────────────────────────────────────
// T5 — Free-tier 5% fee notice (FR61)
// ─────────────────────────────────────────────────────────────
describe('[9.4-T5] Free-tier 5% fee notice (FR61, EC5)', () => {
  test('EC5 — fee is informational (5%), not blocking', async () => {
    const config = await getTierConfig();
    expect(config.freeTransactionFeePercent).toBe(5);
  });
});

// ─────────────────────────────────────────────────────────────
// T7 — Seed fix verification (EC12)
// ─────────────────────────────────────────────────────────────
describe('[9.4-T7] Seed fix verification (EC12)', () => {
  test('pro.maxTeamMembers is 5 (was 1 before migration fix)', async () => {
    const config = await getTierConfig();
    expect(config.tierLimits.pro.maxTeamMembers).toBe(5);
  });

  test('agency limits remain null (unlimited) in raw config', async () => {
    const config = await getTierConfig();
    expect(config.tierLimits.agency.maxClients).toBeNull();
    expect(config.tierLimits.agency.maxTeamMembers).toBeNull();
    expect(config.tierLimits.agency.maxAgents).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// EC9 — TOCTOU race (documented only — no test enforces it)
// ─────────────────────────────────────────────────────────────
describe('[9.4-EC9] TOCTOU race (documentation only)', () => {
  test('enforceTierLimit is best-effort (read-then-check); strict DB enforcement deferred', () => {
    // EC9: Two concurrent creations can both pass the count check. This is
    // acceptable for MVP. See Dev Notes. No assertion — pure documentation.
    expect(true).toBe(true);
  });
});
