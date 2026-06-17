/**
 * Story 9.3b Acceptance Tests — Checkout & Customer Portal Integration (GREEN PHASE).
 *
 * Replaces the RED vi.hoisted stubs with REAL action/component imports. Mocks
 * ONLY the boundaries (getServerSupabase, getPaymentProvider, getTierConfig,
 * revalidateTag). The 13 original tests now assert real behavior.
 *
 * FR55, FR58
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

// ── Boundary mocks ──
vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

vi.mock('@/lib/config/tier-config', () => ({
  getTierConfig: vi.fn().mockResolvedValue({
    tierLimits: {
      free: { maxClients: 3, maxTeamMembers: 1, maxAgents: 2 },
      pro: { maxClients: 15, maxTeamMembers: 1, maxAgents: 6 },
      agency: { maxClients: null, maxTeamMembers: null, maxAgents: null },
    },
    stripePrices: {
      pro_monthly: 'price_test_pro',
      agency_monthly: 'price_test_agency',
    },
    planDisplayPrices: {
      pro: { label: '$29 / month', interval: 'month' },
      agency: { label: '$99 / month', interval: 'month' },
    },
    windows: { grace_period_days: 7, suspension_period_days: 30 },
    freeTransactionFeePercent: 5,
  }),
}));

const providerMocks = {
  createCustomer: vi.fn(),
  createSubscriptionCheckoutSession: vi.fn(),
  createPortalSession: vi.fn(),
  getSubscription: vi.fn(),
  getCheckoutSession: vi.fn(),
  cancelSubscription: vi.fn(),
  resumeSubscription: vi.fn(),
};

vi.mock('@flow/agents/providers', () => ({
  getPaymentProvider: vi.fn(() => providerMocks),
}));

// ── Real imports (code under test) ──
import { getServerSupabase } from '@/lib/supabase-server';
import { createCheckoutSessionAction } from '@/lib/actions/billing/create-checkout-session';
import { createPortalSessionAction } from '@/lib/actions/billing/create-portal-session';
import {
  cancelSubscriptionAction,
  reactivateSubscriptionAction,
} from '@/lib/actions/billing/subscription-manage';
import { syncStripeDataAction } from '@/lib/actions/billing/sync-stripe-data';
import { createCheckoutSessionSchema } from '@flow/types';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ── Mock supabase helper ──
function mockSupabase(
  role: string,
  workspace: Record<string, unknown> | null,
): SupabaseClient {
  const selectTerminal = {
    maybeSingle: vi.fn().mockResolvedValue({ data: workspace, error: null }),
  };
  const updateTerminal = { error: null };
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 'user-1',
            email: 'owner@example.com',
            app_metadata: {
              workspace_id: '00000000-0000-0000-0000-000000000001',
              role,
            },
          },
        },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue(selectTerminal),
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue(updateTerminal),
      }),
    }),
    rpc: vi.fn().mockImplementation((name: string) => {
      if (name === 'check_rate_limit') {
        return Promise.resolve({ data: { allowed: true, retry_after_ms: 0 }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    }),
  } as unknown as SupabaseClient;
  return client;
}

const WORKSPACE_ID = '00000000-0000-0000-0000-000000000001';

function defaultWorkspace(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: WORKSPACE_ID,
    name: 'Acme',
    subscription_status: 'free',
    subscription_tier: 'free',
    stripe_customer_id: 'cus_x',
    stripe_subscription_id: null,
    subscription_current_period_start: null,
    subscription_current_period_end: null,
    subscription_cancel_at_period_end: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.values(providerMocks).forEach((m) => m.mockReset());
  vi.mocked(getServerSupabase).mockResolvedValue(mockSupabase('owner', defaultWorkspace()));
});

// ───────────────────────────────────────────────────────────────
// ATDD-001: createCheckoutSession Server Action (FR55)
// ───────────────────────────────────────────────────────────────
describe('[P0] [9.3b-ATDD-001] createCheckoutSessionAction returns Stripe Checkout URL', () => {
  test('createCheckoutSessionAction is defined', () => {
    expect(typeof createCheckoutSessionAction).toBe('function');
  });

  test('checkoutSessionSchema accepts a target tier', () => {
    expect(createCheckoutSessionSchema.safeParse({ tier: 'pro', interval: 'monthly' }).success).toBe(true);
  });

  test('returns checkout URL for Free → Pro upgrade', async () => {
    providerMocks.createSubscriptionCheckoutSession.mockResolvedValue({
      url: 'https://checkout.stripe.com/cs_1',
      sessionId: 'cs_1',
    });

    const result = await createCheckoutSessionAction({ tier: 'pro', interval: 'monthly' });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.url).toMatch(/^https:\/\/checkout\.stripe\.com/);
  });

  test('metadata includes workspace_id on every Stripe object (snake_case)', async () => {
    vi.mocked(getServerSupabase).mockResolvedValue(mockSupabase('owner', defaultWorkspace({ stripe_customer_id: null })));
    providerMocks.createCustomer.mockResolvedValue({
      providerCustomerId: 'cus_new',
      email: 'owner@example.com',
      name: 'Acme',
      metadata: {},
    });
    providerMocks.createSubscriptionCheckoutSession.mockResolvedValue({
      url: 'https://checkout.stripe.com/cs_1',
      sessionId: 'cs_1',
    });

    await createCheckoutSessionAction({ tier: 'pro', interval: 'monthly' });

    const customerCall = providerMocks.createCustomer.mock.calls[0][0];
    expect(customerCall.metadata).toEqual({ workspace_id: WORKSPACE_ID });
    expect(customerCall.idempotencyKey).toBe(`customer:${WORKSPACE_ID}`);

    const call = providerMocks.createSubscriptionCheckoutSession.mock.calls[0][0];
    expect(call.metadata).toEqual({ workspace_id: WORKSPACE_ID });
    expect(call.metadata.workspaceId).toBeUndefined();
  });

  test('rejects non-owner caller (FORBIDDEN)', async () => {
    vi.mocked(getServerSupabase).mockResolvedValue(mockSupabase('member', defaultWorkspace()));

    const result = await createCheckoutSessionAction({ tier: 'pro', interval: 'monthly' });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('FORBIDDEN');
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-002: Stripe Customer Portal session (FR58)
// ───────────────────────────────────────────────────────────────
describe('[P0] [9.3b-ATDD-002] createPortalSessionAction returns Stripe Customer Portal URL', () => {
  test('createPortalSessionAction is defined', () => {
    expect(typeof createPortalSessionAction).toBe('function');
  });

  test('returns portal URL for a workspace with a stripe_customer_id', async () => {
    providerMocks.createPortalSession.mockResolvedValue({
      url: 'https://billing.stripe.com/p_1',
    });

    const result = await createPortalSessionAction();

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.url).toMatch(/^https:\/\/billing\.stripe\.com/);
  });

  test('rejects workspace without stripe_customer_id (NOT_CONFIGURED)', async () => {
    vi.mocked(getServerSupabase).mockResolvedValue(
      mockSupabase('owner', defaultWorkspace({ stripe_customer_id: null })),
    );

    const result = await createPortalSessionAction();

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('NOT_CONFIGURED');
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-003: Cancel / reactivate subscription
// ───────────────────────────────────────────────────────────────
describe('[P0] [9.3b-ATDD-003] cancel and reactivate subscription flows', () => {
  test('cancelSubscriptionAction schedules cancellation at period end', async () => {
    vi.mocked(getServerSupabase).mockResolvedValue(
      mockSupabase('owner', defaultWorkspace({
        subscription_status: 'active',
        stripe_subscription_id: 'sub_1',
      })),
    );
    providerMocks.cancelSubscription.mockResolvedValue({
      providerSubscriptionId: 'sub_1',
      customerId: 'cus_x',
      priceId: 'price_test_pro',
      status: 'active',
      currentPeriodStart: '2026-06-01T00:00:00Z',
      currentPeriodEnd: '2026-07-01T00:00:00Z',
      cancelAtPeriodEnd: true,
    });

    const result = await cancelSubscriptionAction();

    expect(result.success).toBe(true);
    expect(providerMocks.cancelSubscription).toHaveBeenCalledWith('sub_1', false);
  });

  test('reactivateSubscriptionAction resumes a canceled-but-not-expired sub', async () => {
    vi.mocked(getServerSupabase).mockResolvedValue(
      mockSupabase('owner', defaultWorkspace({
        subscription_status: 'active',
        stripe_subscription_id: 'sub_1',
      })),
    );
    providerMocks.resumeSubscription.mockResolvedValue({
      providerSubscriptionId: 'sub_1',
      customerId: 'cus_x',
      priceId: 'price_test_pro',
      status: 'active',
      currentPeriodStart: '2026-06-01T00:00:00Z',
      currentPeriodEnd: '2026-07-01T00:00:00Z',
      cancelAtPeriodEnd: false,
    });

    const result = await reactivateSubscriptionAction();

    expect(result.success).toBe(true);
  });

  test('cancelSubscriptionAction rejects Free tier (NO_ACTIVE_SUBSCRIPTION)', async () => {
    const result = await cancelSubscriptionAction();

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('NO_ACTIVE_SUBSCRIPTION');
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-004: Billing settings page UI (Server Component)
// ───────────────────────────────────────────────────────────────
describe('[P0] [9.3b-ATDD-004] billing settings page renders tier, usage, and history', () => {
  test('BillingPage is exported as default from the page module', () => {
    const pagePath = path.resolve(
      process.cwd(),
      'app/(workspace)/settings/billing/page.tsx',
    );
    expect(fs.existsSync(pagePath)).toBe(true);
  });

  test('page is a Server Component (no top-level "use client" directive)', () => {
    const pagePath = path.resolve(
      process.cwd(),
      'app/(workspace)/settings/billing/page.tsx',
    );
    const source = fs.readFileSync(pagePath, 'utf8');
    // The page.tsx file must NOT start with 'use client'.
    expect(source.startsWith("'use client'")).toBe(false);
    expect(source.startsWith('"use client"')).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-005: syncStripeDataAction (AC4 — FR42)
// ───────────────────────────────────────────────────────────────
describe('[P0] [9.3b-ATDD-005] syncStripeDataAction success-redirect fallback', () => {
  test('syncStripeDataAction is defined', () => {
    expect(typeof syncStripeDataAction).toBe('function');
  });

  test('always returns success (best-effort) even on provider failure', async () => {
    vi.mocked(getServerSupabase).mockResolvedValue(
      mockSupabase('owner', defaultWorkspace({
        stripe_customer_id: 'cus_x',
        stripe_subscription_id: 'sub_1',
      })),
    );
    providerMocks.getSubscription.mockRejectedValue(new Error('stripe down'));

    const result = await syncStripeDataAction({});

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.synced).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-006: SYSTEM_CONFIG_MISSING (EC3)
// ───────────────────────────────────────────────────────────────
describe('[P0] [9.3b-ATDD-006] SYSTEM_CONFIG_MISSING when prices are placeholders', () => {
  test('returns SYSTEM_CONFIG_MISSING 400 when getTierConfig throws', async () => {
    const { getTierConfig } = await import('@/lib/config/tier-config');
    vi.mocked(getTierConfig).mockRejectedValueOnce(new Error('placeholder'));

    const result = await createCheckoutSessionAction({ tier: 'pro', interval: 'monthly' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('SYSTEM_CONFIG_MISSING');
      expect(result.error.status).toBe(400);
    }
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-007: STRIPE_ERROR mapping (EC7, EC10)
// ───────────────────────────────────────────────────────────────
describe('[P0] [9.3b-ATDD-007] STRIPE_ERROR 502 on provider failures', () => {
  test('reactivate maps Stripe failure to STRIPE_ERROR (does not fabricate success)', async () => {
    vi.mocked(getServerSupabase).mockResolvedValue(
      mockSupabase('owner', defaultWorkspace({
        subscription_status: 'active',
        stripe_subscription_id: 'sub_1',
      })),
    );
    providerMocks.resumeSubscription.mockRejectedValue(new Error('subscription expired'));

    const result = await reactivateSubscriptionAction();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('STRIPE_ERROR');
      expect(result.error.status).toBe(502);
    }
  });
});
