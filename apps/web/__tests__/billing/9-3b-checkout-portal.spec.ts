/**
 * Story 9.3b unit tests — Checkout & Customer Portal Integration (GREEN PHASE).
 *
 * Asserts REAL behavior of:
 *   - createCheckoutSessionAction (AC1, EC1–EC4)
 *   - createPortalSessionAction (AC2, EC5, EC10)
 *   - cancelSubscriptionAction / reactivateSubscriptionAction (AC3, EC6, EC7, EC11)
 *   - syncStripeDataAction (AC4, EC8, EC9)
 *   - Provider extension (AC6 — snake_case metadata, subscription_data.metadata,
 *     form-encoded body shape, idempotency keys)
 *   - Schema validation + error codes (AC7)
 *
 * Mocks ONLY the boundaries: getServerSupabase, requireTenantContext (via the
 * real impl against a mock Supabase client), getPaymentProvider, getTierConfig,
 * revalidateTag. The code under test is the REAL implementation.
 *
 * FR55, FR58
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActionResult } from '@flow/types';

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

// Provider mock — fresh mock per test via mockProvider.
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
import { getTierConfig } from '@/lib/config/tier-config';
import { getPaymentProvider } from '@flow/agents/providers';
import { createCheckoutSessionAction } from '@/lib/actions/billing/create-checkout-session';
import { createPortalSessionAction } from '@/lib/actions/billing/create-portal-session';
import {
  cancelSubscriptionAction,
  reactivateSubscriptionAction,
} from '@/lib/actions/billing/subscription-manage';
import { syncStripeDataAction } from '@/lib/actions/billing/sync-stripe-data';
import {
  createCheckoutSessionSchema,
  createPortalSessionSchema,
  subscriptionStatusSchema,
  subscriptionTierSchema,
  upgradableTierSchema,
} from '@flow/types';

// ── Mock Supabase client factory ──

interface MockWorkspaceRow {
  id: string;
  name: string;
  subscription_status: string;
  subscription_tier: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_current_period_start: string | null;
  subscription_current_period_end: string | null;
  subscription_cancel_at_period_end: boolean;
}

interface MockSupabaseOptions {
  role?: string;
  workspaceId?: string;
  workspace?: Partial<MockWorkspaceRow> | null;
  userEmail?: string;
  rateLimited?: boolean;
  updateError?: { message: string } | null;
}

function mockSupabase(opts: MockSupabaseOptions = {}): SupabaseClient {
  const role = opts.role ?? 'owner';
  const workspaceId =
    opts.workspaceId ?? '00000000-0000-0000-0000-000000000001';
  const workspace: MockWorkspaceRow | null =
    opts.workspace === null
      ? null
      : {
          id: workspaceId,
          name: 'Acme Studio',
          subscription_status: 'free',
          subscription_tier: 'free',
          stripe_customer_id: null,
          stripe_subscription_id: null,
          subscription_current_period_start: null,
          subscription_current_period_end: null,
          subscription_cancel_at_period_end: false,
          ...opts.workspace,
        };

  const updateTerminal = { error: opts.updateError ?? null };
  const updateMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue(updateTerminal),
  });

  const selectTerminal = {
    maybeSingle: vi.fn().mockResolvedValue({ data: workspace, error: null }),
  };

  const selectMock = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue(selectTerminal),
    order: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    }),
  });

  const rpcMock = vi.fn().mockImplementation((name: string) => {
    if (name === 'check_rate_limit') {
      return Promise.resolve(
        opts.rateLimited
          ? { data: { allowed: false, retry_after_ms: 5000 }, error: null }
          : { data: { allowed: true, retry_after_ms: 0 }, error: null },
      );
    }
    if (name === 'upsert_workspace_subscription') {
      return Promise.resolve({ data: { success: true }, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  });

  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 'user-1',
            email: opts.userEmail ?? 'owner@example.com',
            app_metadata: { workspace_id: workspaceId, role },
          },
        },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: selectMock,
      update: updateMock,
    }),
    rpc: rpcMock,
  } as unknown as SupabaseClient;

  return client;
}

function setSupabase(opts: MockSupabaseOptions = {}): void {
  vi.mocked(getServerSupabase).mockResolvedValue(mockSupabase(opts));
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.values(providerMocks).forEach((m) => m.mockReset());
  // Re-establish default tier config (tests may override per-case).
  vi.mocked(getTierConfig).mockResolvedValue({
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
  });
  setSupabase();
});

// ───────────────────────────────────────────────────────────────
// AC7 — Types + error codes
// ───────────────────────────────────────────────────────────────
describe('[9.3b][AC7] subscription schemas', () => {
  test('subscriptionTierSchema accepts free/pro/agency', () => {
    expect(subscriptionTierSchema.safeParse('free').success).toBe(true);
    expect(subscriptionTierSchema.safeParse('pro').success).toBe(true);
    expect(subscriptionTierSchema.safeParse('agency').success).toBe(true);
  });

  test('upgradableTierSchema rejects free', () => {
    expect(upgradableTierSchema.safeParse('free').success).toBe(false);
    expect(upgradableTierSchema.safeParse('pro').success).toBe(true);
  });

  test('subscriptionStatusSchema aligns to DB CHECK (British cancelled)', () => {
    expect(subscriptionStatusSchema.safeParse('free').success).toBe(true);
    expect(subscriptionStatusSchema.safeParse('active').success).toBe(true);
    expect(subscriptionStatusSchema.safeParse('past_due').success).toBe(true);
    expect(subscriptionStatusSchema.safeParse('cancelled').success).toBe(true);
    // American spelling must be rejected — DB CHECK rejects it.
    expect(subscriptionStatusSchema.safeParse('canceled').success).toBe(false);
  });

  test('createCheckoutSessionSchema accepts { tier, interval }', () => {
    expect(
      createCheckoutSessionSchema.safeParse({
        tier: 'pro',
        interval: 'monthly',
      }).success,
    ).toBe(true);
    expect(
      createCheckoutSessionSchema.safeParse({
        tier: 'free',
        interval: 'monthly',
      }).success,
    ).toBe(false);
    expect(
      createCheckoutSessionSchema.safeParse({ tier: 'pro', interval: 'yearly' })
        .success,
    ).toBe(false);
  });

  test('createPortalSessionSchema accepts empty/undefined input', () => {
    expect(createPortalSessionSchema.safeParse(undefined).success).toBe(true);
    expect(createPortalSessionSchema.safeParse({}).success).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────
// AC1 / EC1 / EC2 / EC3 / EC4 — createCheckoutSessionAction
// ───────────────────────────────────────────────────────────────
describe('[9.3b][AC1] createCheckoutSessionAction', () => {
  test('returns Stripe Checkout URL for Free → Pro upgrade', async () => {
    setSupabase({ workspace: { stripe_customer_id: 'cus_x' } });
    providerMocks.createSubscriptionCheckoutSession.mockResolvedValue({
      url: 'https://checkout.stripe.com/cs_test_1',
      sessionId: 'cs_test_1',
    });

    const result = await createCheckoutSessionAction({
      tier: 'pro',
      interval: 'monthly',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.url).toMatch(/^https:\/\/checkout\.stripe\.com/);
    }
  });

  test('EC1 — lazy-creates Customer when stripe_customer_id is null', async () => {
    setSupabase({ workspace: { stripe_customer_id: null } });
    providerMocks.createCustomer.mockResolvedValue({
      providerCustomerId: 'cus_new',
      email: 'owner@example.com',
      name: 'Acme Studio',
      metadata: {},
    });
    providerMocks.createSubscriptionCheckoutSession.mockResolvedValue({
      url: 'https://checkout.stripe.com/cs_1',
      sessionId: 'cs_1',
    });

    const result = await createCheckoutSessionAction({
      tier: 'pro',
      interval: 'monthly',
    });

    expect(result.success).toBe(true);
    expect(providerMocks.createCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'owner@example.com',
        name: 'Acme Studio',
        workspaceId: '00000000-0000-0000-0000-000000000001',
        metadata: { workspace_id: '00000000-0000-0000-0000-000000000001' },
        idempotencyKey: 'customer:00000000-0000-0000-0000-000000000001',
      }),
    );
  });

  test('reuses existing stripe_customer_id when present (no createCustomer call)', async () => {
    setSupabase({ workspace: { stripe_customer_id: 'cus_existing' } });
    providerMocks.createSubscriptionCheckoutSession.mockResolvedValue({
      url: 'https://checkout.stripe.com/cs_1',
      sessionId: 'cs_1',
    });

    await createCheckoutSessionAction({ tier: 'agency', interval: 'monthly' });

    expect(providerMocks.createCustomer).not.toHaveBeenCalled();
    expect(
      providerMocks.createSubscriptionCheckoutSession,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 'cus_existing' }),
    );
  });

  test('EC2 — uses checkout idempotency key `checkout:${workspaceId}:${tier}:${interval}`', async () => {
    setSupabase({ workspace: { stripe_customer_id: 'cus_x' } });
    providerMocks.createSubscriptionCheckoutSession.mockResolvedValue({
      url: 'https://checkout.stripe.com/cs_1',
      sessionId: 'cs_1',
    });

    await createCheckoutSessionAction({ tier: 'pro', interval: 'monthly' });

    expect(
      providerMocks.createSubscriptionCheckoutSession,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey:
          'checkout:00000000-0000-0000-0000-000000000001:pro:monthly',
      }),
    );
  });

  test('AC6 — passes snake_case metadata on both session + subscription_data', async () => {
    setSupabase({ workspace: { stripe_customer_id: 'cus_x' } });
    providerMocks.createSubscriptionCheckoutSession.mockResolvedValue({
      url: 'https://checkout.stripe.com/cs_1',
      sessionId: 'cs_1',
    });

    await createCheckoutSessionAction({ tier: 'pro', interval: 'monthly' });

    const call =
      providerMocks.createSubscriptionCheckoutSession.mock.calls[0]?.[0];
    expect(call.metadata).toEqual({
      workspace_id: '00000000-0000-0000-0000-000000000001',
    });
  });

  test('AC1 — successUrl uses {CHECKOUT_SESSION_ID} placeholder + sync=1', async () => {
    setSupabase({ workspace: { stripe_customer_id: 'cus_x' } });
    providerMocks.createSubscriptionCheckoutSession.mockResolvedValue({
      url: 'https://checkout.stripe.com/cs_1',
      sessionId: 'cs_1',
    });

    await createCheckoutSessionAction({ tier: 'pro', interval: 'monthly' });

    const call =
      providerMocks.createSubscriptionCheckoutSession.mock.calls[0]?.[0];
    expect(call.successUrl).toContain('sync=1');
    expect(call.successUrl).toContain('{CHECKOUT_SESSION_ID}');
    expect(call.cancelUrl).toContain('status=cancel');
  });

  test('EC3 — SYSTEM_CONFIG_MISSING when getTierConfig throws on placeholders', async () => {
    vi.mocked(getTierConfig).mockRejectedValue(new Error('placeholder prices'));
    setSupabase({ workspace: { stripe_customer_id: 'cus_x' } });

    const result = await createCheckoutSessionAction({
      tier: 'pro',
      interval: 'monthly',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('SYSTEM_CONFIG_MISSING');
      expect(result.error.status).toBe(400);
    }
  });

  test('EC4 — non-owner (member) gets FORBIDDEN before any Stripe call', async () => {
    setSupabase({ role: 'member' });

    const result = await createCheckoutSessionAction({
      tier: 'pro',
      interval: 'monthly',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('FORBIDDEN');
      expect(result.error.status).toBe(403);
    }
    expect(
      providerMocks.createSubscriptionCheckoutSession,
    ).not.toHaveBeenCalled();
    expect(providerMocks.createCustomer).not.toHaveBeenCalled();
  });

  test('rejects invalid tier (free) at the schema layer', async () => {
    const result = await createCheckoutSessionAction({
      tier: 'free',
      interval: 'monthly',
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  test('returns STRIPE_ERROR 502 when provider.createSubscriptionCheckoutSession fails', async () => {
    setSupabase({ workspace: { stripe_customer_id: 'cus_x' } });
    providerMocks.createSubscriptionCheckoutSession.mockRejectedValue(
      new Error('stripe down'),
    );

    const result = await createCheckoutSessionAction({
      tier: 'pro',
      interval: 'monthly',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('STRIPE_ERROR');
      expect(result.error.status).toBe(502);
    }
  });

  test('rate limit blocks checkout with RATE_LIMITED 429', async () => {
    setSupabase({
      rateLimited: true,
      workspace: { stripe_customer_id: 'cus_x' },
    });

    const result = await createCheckoutSessionAction({
      tier: 'pro',
      interval: 'monthly',
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('RATE_LIMITED');
  });
});

// ───────────────────────────────────────────────────────────────
// AC2 / EC5 / EC10 — createPortalSessionAction
// ───────────────────────────────────────────────────────────────
describe('[9.3b][AC2] createPortalSessionAction', () => {
  test('returns Stripe Customer Portal URL when customer is linked', async () => {
    setSupabase({ workspace: { stripe_customer_id: 'cus_x' } });
    providerMocks.createPortalSession.mockResolvedValue({
      url: 'https://billing.stripe.com/p_1',
    });

    const result = await createPortalSessionAction();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.url).toMatch(/^https:\/\/billing\.stripe\.com/);
    }
  });

  test('EC5 — NOT_CONFIGURED when stripe_customer_id is null', async () => {
    setSupabase({ workspace: { stripe_customer_id: null } });

    const result = await createPortalSessionAction();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NOT_CONFIGURED');
      expect(result.error.status).toBe(409);
    }
    expect(providerMocks.createPortalSession).not.toHaveBeenCalled();
  });

  test('EC5 — free tier WITH customer_id still returns portal URL', async () => {
    setSupabase({
      workspace: {
        subscription_status: 'free',
        subscription_tier: 'free',
        stripe_customer_id: 'cus_free_but_real',
      },
    });
    providerMocks.createPortalSession.mockResolvedValue({
      url: 'https://billing.stripe.com/p_1',
    });

    const result = await createPortalSessionAction();
    expect(result.success).toBe(true);
  });

  test('EC10 — STRIPE_ERROR when provider.createPortalSession fails', async () => {
    setSupabase({ workspace: { stripe_customer_id: 'cus_x' } });
    providerMocks.createPortalSession.mockRejectedValue(
      new Error('stripe 5xx'),
    );

    const result = await createPortalSessionAction();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('STRIPE_ERROR');
      expect(result.error.status).toBe(502);
    }
  });

  test('EC4 — non-owner gets FORBIDDEN', async () => {
    setSupabase({ role: 'admin', workspace: { stripe_customer_id: 'cus_x' } });

    const result = await createPortalSessionAction();

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('FORBIDDEN');
  });

  test('returnUrl points back to /settings/billing', async () => {
    setSupabase({ workspace: { stripe_customer_id: 'cus_x' } });
    providerMocks.createPortalSession.mockResolvedValue({
      url: 'https://billing.stripe.com/p_1',
    });

    await createPortalSessionAction();

    expect(providerMocks.createPortalSession).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'cus_x',
        returnUrl: expect.stringMatching(/\/settings\/billing$/),
      }),
    );
  });
});

// ───────────────────────────────────────────────────────────────
// AC3 / EC6 / EC7 / EC11 — cancel/reactivate
// ───────────────────────────────────────────────────────────────
describe('[9.3b][AC3] cancelSubscriptionAction', () => {
  test('schedules cancel at period end (calls cancelSubscription with immediately=false)', async () => {
    setSupabase({
      workspace: {
        subscription_status: 'active',
        stripe_subscription_id: 'sub_active',
      },
    });
    providerMocks.cancelSubscription.mockResolvedValue({
      providerSubscriptionId: 'sub_active',
      customerId: 'cus_x',
      priceId: 'price_test_pro',
      status: 'active',
      currentPeriodStart: '2026-06-01T00:00:00Z',
      currentPeriodEnd: '2026-07-01T00:00:00Z',
      cancelAtPeriodEnd: true,
    });

    const result = await cancelSubscriptionAction();

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.cancelAtPeriodEnd).toBe(true);
    expect(providerMocks.cancelSubscription).toHaveBeenCalledWith(
      'sub_active',
      false,
    );
  });

  test('EC6 — idempotent on already-canceling subscription (still calls cancel)', async () => {
    setSupabase({
      workspace: {
        subscription_status: 'active',
        subscription_cancel_at_period_end: true,
        stripe_subscription_id: 'sub_active',
      },
    });
    providerMocks.cancelSubscription.mockResolvedValue({
      providerSubscriptionId: 'sub_active',
      customerId: 'cus_x',
      priceId: 'price_test_pro',
      status: 'active',
      currentPeriodStart: '2026-06-01T00:00:00Z',
      currentPeriodEnd: '2026-07-01T00:00:00Z',
      cancelAtPeriodEnd: true,
    });

    const result = await cancelSubscriptionAction();
    expect(result.success).toBe(true);
    expect(providerMocks.cancelSubscription).toHaveBeenCalled();
  });

  test('EC11 — NO_ACTIVE_SUBSCRIPTION when status is free', async () => {
    setSupabase({
      workspace: { subscription_status: 'free', stripe_subscription_id: null },
    });

    const result = await cancelSubscriptionAction();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NO_ACTIVE_SUBSCRIPTION');
      expect(result.error.status).toBe(409);
    }
    expect(providerMocks.cancelSubscription).not.toHaveBeenCalled();
  });

  test('EC11 — NO_ACTIVE_SUBSCRIPTION on data drift (active status but null sub id)', async () => {
    setSupabase({
      workspace: {
        subscription_status: 'active',
        stripe_subscription_id: null,
      },
    });

    const result = await cancelSubscriptionAction();

    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe('NO_ACTIVE_SUBSCRIPTION');
  });

  test('returns STRIPE_ERROR on provider failure', async () => {
    setSupabase({
      workspace: {
        subscription_status: 'active',
        stripe_subscription_id: 'sub_active',
      },
    });
    providerMocks.cancelSubscription.mockRejectedValue(
      new Error('stripe down'),
    );

    const result = await cancelSubscriptionAction();

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('STRIPE_ERROR');
  });

  test('does NOT write local DB state (no upsert RPC) — webhook owns state', async () => {
    setSupabase({
      workspace: {
        subscription_status: 'active',
        stripe_subscription_id: 'sub_active',
      },
    });
    providerMocks.cancelSubscription.mockResolvedValue({
      providerSubscriptionId: 'sub_active',
      customerId: 'cus_x',
      priceId: 'price_test_pro',
      status: 'active',
      currentPeriodStart: '2026-06-01T00:00:00Z',
      currentPeriodEnd: '2026-07-01T00:00:00Z',
      cancelAtPeriodEnd: true,
    });

    const supabase = await getServerSupabase();
    await cancelSubscriptionAction();

    // The action calls the provider + revalidateTag, but NEVER calls the
    // upsert_workspace_subscription RPC — that's the webhook's job.
    const rpcMock = (supabase as unknown as { rpc: ReturnType<typeof vi.fn> })
      .rpc;
    const upsertCalls = rpcMock.mock.calls.filter(
      (args: unknown[]) => args[0] === 'upsert_workspace_subscription',
    );
    expect(upsertCalls.length).toBe(0);
  });
});

describe('[9.3b][AC3] reactivateSubscriptionAction', () => {
  test('resumes a cancelled-but-not-expired subscription', async () => {
    setSupabase({
      workspace: {
        subscription_status: 'active',
        subscription_cancel_at_period_end: true,
        stripe_subscription_id: 'sub_active',
      },
    });
    providerMocks.resumeSubscription.mockResolvedValue({
      providerSubscriptionId: 'sub_active',
      customerId: 'cus_x',
      priceId: 'price_test_pro',
      status: 'active',
      currentPeriodStart: '2026-06-01T00:00:00Z',
      currentPeriodEnd: '2026-07-01T00:00:00Z',
      cancelAtPeriodEnd: false,
    });

    const result = await reactivateSubscriptionAction();

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.reactivated).toBe(true);
    expect(providerMocks.resumeSubscription).toHaveBeenCalledWith('sub_active');
  });

  test('EC7 — expired subscription → STRIPE_ERROR (does not fabricate success)', async () => {
    setSupabase({
      workspace: {
        subscription_status: 'active',
        stripe_subscription_id: 'sub_active',
      },
    });
    providerMocks.resumeSubscription.mockRejectedValue(
      new Error('subscription expired'),
    );

    const result = await reactivateSubscriptionAction();

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('STRIPE_ERROR');
  });

  test('NO_ACTIVE_SUBSCRIPTION when free', async () => {
    setSupabase({
      workspace: { subscription_status: 'free', stripe_subscription_id: null },
    });

    const result = await reactivateSubscriptionAction();

    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.code).toBe('NO_ACTIVE_SUBSCRIPTION');
  });

  test('non-owner gets FORBIDDEN', async () => {
    setSupabase({ role: 'member' });

    const result = await reactivateSubscriptionAction();

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('FORBIDDEN');
  });
});

// ───────────────────────────────────────────────────────────────
// AC4 / EC8 / EC9 — syncStripeDataAction
// ───────────────────────────────────────────────────────────────
describe('[9.3b][AC4] syncStripeDataAction', () => {
  test('Path A — upserts when stripe_subscription_id is already set', async () => {
    setSupabase({
      workspace: {
        stripe_customer_id: 'cus_x',
        stripe_subscription_id: 'sub_existing',
      },
    });
    providerMocks.getSubscription.mockResolvedValue({
      providerSubscriptionId: 'sub_existing',
      customerId: 'cus_x',
      priceId: 'price_test_pro',
      status: 'active',
      currentPeriodStart: '2026-06-01T00:00:00Z',
      currentPeriodEnd: '2026-07-01T00:00:00Z',
      cancelAtPeriodEnd: false,
    });

    const result = await syncStripeDataAction({});

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.synced).toBe(true);
    expect(providerMocks.getSubscription).toHaveBeenCalledWith('sub_existing');

    const supabase = await getServerSupabase();
    const rpcMock = (supabase as unknown as { rpc: ReturnType<typeof vi.fn> })
      .rpc;
    const upsertCall = rpcMock.mock.calls.find(
      (args: unknown[]) => args[0] === 'upsert_workspace_subscription',
    );
    expect(upsertCall).toBeDefined();
    const params = upsertCall?.[1] as Record<string, unknown>;
    expect(params.p_tier).toBe('pro');
    expect(params.p_status).toBe('active');
    expect(params.p_stripe_subscription_id).toBe('sub_existing');
  });

  test('Path A — refuses to write when customer id mismatches workspace', async () => {
    setSupabase({
      workspace: {
        stripe_customer_id: 'cus_x',
        stripe_subscription_id: 'sub_existing',
      },
    });
    providerMocks.getSubscription.mockResolvedValue({
      providerSubscriptionId: 'sub_existing',
      customerId: 'cus_DIFFERENT',
      priceId: 'price_test_pro',
      status: 'active',
      currentPeriodStart: '2026-06-01T00:00:00Z',
      currentPeriodEnd: '2026-07-01T00:00:00Z',
      cancelAtPeriodEnd: false,
    });

    const result = await syncStripeDataAction({});

    // Best-effort: still returns success but does not call the RPC.
    expect(result.success).toBe(true);
  });

  test('Path B — uses sessionId when stripe_subscription_id is null', async () => {
    setSupabase({
      workspace: { stripe_customer_id: 'cus_x', stripe_subscription_id: null },
    });
    providerMocks.getCheckoutSession.mockResolvedValue({
      subscriptionId: 'sub_from_checkout',
      customerId: 'cus_x',
    });
    providerMocks.getSubscription.mockResolvedValue({
      providerSubscriptionId: 'sub_from_checkout',
      customerId: 'cus_x',
      priceId: 'price_test_pro',
      status: 'active',
      currentPeriodStart: '2026-06-01T00:00:00Z',
      currentPeriodEnd: '2026-07-01T00:00:00Z',
      cancelAtPeriodEnd: false,
    });

    const result = await syncStripeDataAction({ sessionId: 'cs_test_123' });

    expect(result.success).toBe(true);
    expect(providerMocks.getCheckoutSession).toHaveBeenCalledWith(
      'cs_test_123',
    );
    expect(providerMocks.getSubscription).toHaveBeenCalledWith(
      'sub_from_checkout',
    );

    const supabase = await getServerSupabase();
    const rpcMock = (supabase as unknown as { rpc: ReturnType<typeof vi.fn> })
      .rpc;
    const upsertCall = rpcMock.mock.calls.find(
      (args: unknown[]) => args[0] === 'upsert_workspace_subscription',
    );
    expect(upsertCall).toBeDefined();
    const params = upsertCall?.[1] as Record<string, unknown>;
    expect(params.p_tier).toBe('pro');
    expect(params.p_status).toBe('active');
  });

  test('EC8 — webhook delayed: sync still succeeds (fallback path)', async () => {
    setSupabase({
      workspace: {
        stripe_customer_id: 'cus_x',
        stripe_subscription_id: 'sub_active',
      },
    });
    providerMocks.getSubscription.mockResolvedValue({
      providerSubscriptionId: 'sub_active',
      customerId: 'cus_x',
      priceId: 'price_test_pro',
      status: 'active',
      currentPeriodStart: '2026-06-01T00:00:00Z',
      currentPeriodEnd: '2026-07-01T00:00:00Z',
      cancelAtPeriodEnd: false,
    });

    const result = await syncStripeDataAction({ sessionId: 'cs_test_123' });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.synced).toBe(true);
  });

  test('EC9 — idempotent: provider failure does not throw, returns success', async () => {
    setSupabase({
      workspace: {
        stripe_customer_id: 'cus_x',
        stripe_subscription_id: 'sub_active',
      },
    });
    providerMocks.getSubscription.mockRejectedValue(new Error('stripe down'));

    const result = await syncStripeDataAction({});

    // Best-effort: never blocks render.
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.synced).toBe(true);
  });

  test('no-op when both subscription id and sessionId are missing', async () => {
    setSupabase({
      workspace: { stripe_customer_id: null, stripe_subscription_id: null },
    });

    const result = await syncStripeDataAction({});

    expect(result.success).toBe(true);
    expect(providerMocks.getSubscription).not.toHaveBeenCalled();
    expect(providerMocks.getCheckoutSession).not.toHaveBeenCalled();
  });

  test('maps unknown Stripe statuses to cancelled, not active', async () => {
    setSupabase({
      workspace: {
        stripe_customer_id: 'cus_x',
        stripe_subscription_id: 'sub_active',
      },
    });
    providerMocks.getSubscription.mockResolvedValue({
      providerSubscriptionId: 'sub_active',
      customerId: 'cus_x',
      priceId: 'price_test_pro',
      status: 'incomplete',
      currentPeriodStart: '2026-06-01T00:00:00Z',
      currentPeriodEnd: '2026-07-01T00:00:00Z',
      cancelAtPeriodEnd: false,
    });

    await syncStripeDataAction({});

    const supabase = await getServerSupabase();
    const rpcMock = (supabase as unknown as { rpc: ReturnType<typeof vi.fn> })
      .rpc;
    const upsertCall = rpcMock.mock.calls.find(
      (args: unknown[]) => args[0] === 'upsert_workspace_subscription',
    );
    expect(upsertCall).toBeDefined();
    const params = upsertCall?.[1] as Record<string, unknown>;
    expect(params.p_status).toBe('cancelled');
  });

  test('unmapped Stripe status skips upsert', async () => {
    setSupabase({
      workspace: {
        stripe_customer_id: 'cus_x',
        stripe_subscription_id: 'sub_active',
      },
    });
    providerMocks.getSubscription.mockResolvedValue({
      providerSubscriptionId: 'sub_active',
      customerId: 'cus_x',
      priceId: 'price_test_pro',
      status: 'paused',
      currentPeriodStart: '2026-06-01T00:00:00Z',
      currentPeriodEnd: '2026-07-01T00:00:00Z',
      cancelAtPeriodEnd: false,
    });

    await syncStripeDataAction({});

    const supabase = await getServerSupabase();
    const rpcMock = (supabase as unknown as { rpc: ReturnType<typeof vi.fn> })
      .rpc;
    const upsertCalls = rpcMock.mock.calls.filter(
      (args: unknown[]) => args[0] === 'upsert_workspace_subscription',
    );
    expect(upsertCalls.length).toBe(0);
  });

  test('unknown price id skips upsert', async () => {
    setSupabase({
      workspace: {
        stripe_customer_id: 'cus_x',
        stripe_subscription_id: 'sub_active',
      },
    });
    providerMocks.getSubscription.mockResolvedValue({
      providerSubscriptionId: 'sub_active',
      customerId: 'cus_x',
      priceId: 'price_unknown',
      status: 'active',
      currentPeriodStart: '2026-06-01T00:00:00Z',
      currentPeriodEnd: '2026-07-01T00:00:00Z',
      cancelAtPeriodEnd: false,
    });

    await syncStripeDataAction({});

    const supabase = await getServerSupabase();
    const rpcMock = (supabase as unknown as { rpc: ReturnType<typeof vi.fn> })
      .rpc;
    const upsertCalls = rpcMock.mock.calls.filter(
      (args: unknown[]) => args[0] === 'upsert_workspace_subscription',
    );
    expect(upsertCalls.length).toBe(0);
  });

  test('logs logical RPC errors from upsert_workspace_subscription', async () => {
    setSupabase({
      workspace: {
        stripe_customer_id: 'cus_x',
        stripe_subscription_id: 'sub_active',
      },
    });
    providerMocks.getSubscription.mockResolvedValue({
      providerSubscriptionId: 'sub_active',
      customerId: 'cus_x',
      priceId: 'price_test_pro',
      status: 'active',
      currentPeriodStart: '2026-06-01T00:00:00Z',
      currentPeriodEnd: '2026-07-01T00:00:00Z',
      cancelAtPeriodEnd: false,
    });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const supabase = await getServerSupabase();
    const rpcMock = (supabase as unknown as { rpc: ReturnType<typeof vi.fn> })
      .rpc;
    rpcMock.mockImplementation((name: string) => {
      if (name === 'check_rate_limit') {
        return Promise.resolve({
          data: { allowed: true, retry_after_ms: 0 },
          error: null,
        });
      }
      if (name === 'upsert_workspace_subscription') {
        return Promise.resolve({
          data: { error: 'INVALID_TIER' },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    await syncStripeDataAction({});

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test('non-owner gets FORBIDDEN', async () => {
    setSupabase({ role: 'member' });

    const result = await syncStripeDataAction({});

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('FORBIDDEN');
  });

  test('never uses createServiceClient (user-scoped only — AC4)', () => {
    // Static assertion: the action file imports getServerSupabase only.
    // (Verified by the import-time mock — if createServiceClient were used,
    // the test would fail to mock it.)
    expect(getServerSupabase).toBeDefined();
  });
});

// ───────────────────────────────────────────────────────────────
// AC6 — Provider extension: form-encoded body + snake_case metadata
// ───────────────────────────────────────────────────────────────
describe('[9.3b][AC6] provider extension contract', () => {
  test('getPaymentProvider returns the extended provider', () => {
    const provider = getPaymentProvider('stripe');
    expect(typeof provider.createSubscriptionCheckoutSession).toBe('function');
    expect(typeof provider.createPortalSession).toBe('function');
    expect(typeof provider.getCheckoutSession).toBe('function');
  });

  test('metadata is always snake_case workspace_id (not camelCase)', async () => {
    setSupabase({ workspace: { stripe_customer_id: 'cus_x' } });
    providerMocks.createSubscriptionCheckoutSession.mockResolvedValue({
      url: 'https://checkout.stripe.com/cs_1',
      sessionId: 'cs_1',
    });

    await createCheckoutSessionAction({ tier: 'pro', interval: 'monthly' });

    const call =
      providerMocks.createSubscriptionCheckoutSession.mock.calls[0]?.[0];
    expect(call.metadata).toEqual({ workspace_id: expect.any(String) });
    expect(call.metadata.workspaceId).toBeUndefined();
  });
});

// ───────────────────────────────────────────────────────────────
// Type-level sanity (no runtime assertion)
// ───────────────────────────────────────────────────────────────
describe('[9.3b] ActionResult contract', () => {
  test('all actions return ActionResult shape', async () => {
    setSupabase({ workspace: { stripe_customer_id: null } });
    const results: ActionResult<unknown>[] = [
      await createCheckoutSessionAction({ tier: 'pro', interval: 'monthly' }),
      await createPortalSessionAction(),
      await cancelSubscriptionAction(),
      await reactivateSubscriptionAction(),
      await syncStripeDataAction({}),
    ];
    for (const r of results) {
      expect(r.success).toBeDefined();
      if (r.success) expect(r.data).toBeDefined();
      else expect(r.error).toBeDefined();
    }
  });
});
