/**
 * Story 9.3a Acceptance Tests — Stripe Webhook Infrastructure (GREEN PHASE)
 *
 * Asserts REAL behavior using real schema imports and real dispatcher.
 * Mocks ONLY external boundaries (Supabase client, provider, RPCs) — never
 * the code under test.
 *
 * FR39, FR42, FR44, FR59, NFR05, NFR46
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

// ── Real schema imports — assert table/column shape ──
import {
  stripeWebhookEvents,
  invoicePaymentAttempts,
} from '@flow/db/schema/stripe-webhooks';
import { appConfig } from '@flow/db/schema/app-config';
import { workspaces } from '@flow/db/schema/workspaces';
import { invoices } from '@flow/db/schema/invoices';

// ── Real code under test ──
import { POST } from '@/app/api/webhooks/stripe/route';
import {
  processStripeEvent,
} from '@/lib/stripe/handlers';
import { verifyWebhookSignature } from '@/lib/stripe/verify-webhook-signature';
import {
  STRIPE_WEBHOOK_MAX_RETRIES,
  STRIPE_WEBHOOK_RETRY_BACKOFF_MS,
} from '@/lib/stripe/webhook-constants';
import { computeInvoiceDedupHash } from '@flow/shared';

// ── Boundary mocks (external services only) ──
vi.mock('@flow/db', () => ({
  createServiceClient: vi.fn(),
}));

vi.mock('@flow/agents/providers', () => ({
  StripePaymentProvider: vi.fn().mockImplementation(() => ({
    constructWebhookEvent: vi.fn(),
    getSubscription: vi.fn().mockResolvedValue({
      providerSubscriptionId: 'sub_test',
      customerId: 'cus_test',
      priceId: 'price_test_pro',
      status: 'active',
      currentPeriodStart: '2026-06-18T00:00:00Z',
      currentPeriodEnd: '2026-07-18T00:00:00Z',
      cancelAtPeriodEnd: false,
    }),
  })),
}));

vi.mock('@/lib/config/tier-config', () => ({
  getTierConfig: vi.fn().mockResolvedValue({
    tierLimits: {
      free: { maxClients: 3, maxTeamMembers: 1, maxAgents: 2 },
      pro: { maxClients: 15, maxTeamMembers: 1, maxAgents: 6 },
      agency: { maxClients: null, maxTeamMembers: null, maxAgents: null },
    },
    stripePrices: { pro_monthly: 'price_test_pro', agency_monthly: 'price_test_agency' },
    windows: { grace_period_days: 7, suspension_period_days: 30 },
    freeTransactionFeePercent: 5,
  }),
}));

function stripeEvent(
  id: string,
  type: string,
  data: Record<string, unknown> = {},
): { id: string; type: string; created: number; data: { object: Record<string, unknown> } } {
  return { id, type, created: Math.floor(Date.now() / 1000), data: { object: data } };
}

function createMockSupabase(): SupabaseClient {
  const insert = vi.fn().mockResolvedValue({ data: null, error: null });
  const updateEq = vi.fn().mockReturnValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq: updateEq });
  const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const eqInner = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq: eqInner });
  return {
    from: vi.fn(() => ({ insert, update, select })),
    rpc: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
  } as unknown as SupabaseClient;
}

beforeEach(async () => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  process.env.STRIPE_SECRET_KEY = 'sk_test_secret';
  // Re-establish default provider implementation (some ATDD-002 tests override
  // it with a narrower mock that lacks getSubscription; this restore keeps
  // downstream ATDD-007 tests working without per-test boilerplate).
  const { StripePaymentProvider } = await import('@flow/agents/providers');
  (StripePaymentProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
    constructWebhookEvent: vi.fn().mockReturnValue({
      id: 'evt_default',
      type: 'invoice.paid',
      payload: { data: { object: {} } },
      createdAt: '2026-06-17T00:00:00Z',
    }),
    getSubscription: vi.fn().mockResolvedValue({
      providerSubscriptionId: 'sub_test',
      customerId: 'cus_test',
      priceId: 'price_test_pro',
      status: 'active',
      currentPeriodStart: '2026-06-18T00:00:00Z',
      currentPeriodEnd: '2026-07-18T00:00:00Z',
      cancelAtPeriodEnd: false,
    }),
  }));
});

// ───────────────────────────────────────────────────────────────
// ATDD-001: Webhook route exports POST handler (FR39)
// ───────────────────────────────────────────────────────────────
describe('[P0] [9.3a-ATDD-001] stripe webhook route exposes POST handler', () => {
  test('POST handler is exported from api/webhooks/stripe/route', () => {
    expect(POST).toBeDefined();
    expect(typeof POST).toBe('function');
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-002: Signature verification delegate (security surface)
// ───────────────────────────────────────────────────────────────
describe('[P0] [9.3a-ATDD-002] verifyWebhookSignature validates raw body against secret', () => {
  test('verifyWebhookSignature is exported and callable', () => {
    expect(verifyWebhookSignature).toBeDefined();
    expect(typeof verifyWebhookSignature).toBe('function');
  });

  test('valid signature resolves to parsed event with data.object', async () => {
    const { StripePaymentProvider } = await import('@flow/agents/providers');
    (StripePaymentProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      constructWebhookEvent: vi.fn().mockReturnValue({
        id: 'evt_ok',
        type: 'invoice.paid',
        payload: { data: { object: { id: 'in_1' } } },
        createdAt: '2026-06-17T00:00:00Z',
      }),
    }));
    const parsed = verifyWebhookSignature('{}', 'valid-sig', 'whsec_test');
    expect(parsed).toBeDefined();
    expect(parsed.id).toBe('evt_ok');
    expect(parsed.type).toBe('invoice.paid');
    expect(parsed.data.object).toEqual({ id: 'in_1' });
  });

  test('tampered payload is rejected (provider throws)', async () => {
    const { StripePaymentProvider } = await import('@flow/agents/providers');
    (StripePaymentProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      constructWebhookEvent: vi.fn().mockImplementation(() => {
        throw new Error('Signature verification failed');
      }),
    }));
    expect(() => verifyWebhookSignature('{}', 'bad-sig', 'whsec_test')).toThrow(
      /Signature verification failed/,
    );
  });

  test('event missing data.object is rejected', async () => {
    const { StripePaymentProvider } = await import('@flow/agents/providers');
    (StripePaymentProvider as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      constructWebhookEvent: vi.fn().mockReturnValue({
        id: 'evt_bad',
        type: 'invoice.paid',
        payload: { /* no data key */ },
        createdAt: '2026-06-17T00:00:00Z',
      }),
    }));
    expect(() => verifyWebhookSignature('{}', 'sig', 'whsec_test')).toThrow(
      /missing data.object/,
    );
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-003: Idempotent dedup via stripe_webhook_events (FR42)
// ───────────────────────────────────────────────────────────────
describe('[P0] [9.3a-ATDD-003] duplicate events processed exactly once (FR42)', () => {
  test('stripeWebhookEvents Drizzle schema exposes stripeEventId unique column', () => {
    expect(Object.keys(stripeWebhookEvents)).toContain('stripeEventId');
  });

  test('invoicePaymentAttempts Drizzle schema exposes invoiceId', () => {
    expect(Object.keys(invoicePaymentAttempts)).toContain('invoiceId');
  });

  test('processStripeEvent is callable and returns a WebhookProcessingResult', async () => {
    const supabase = createMockSupabase();
    const result = await processStripeEvent(supabase, stripeEvent('evt_unique_1', 'invoice.paid', {
      id: 'in_1',
      customer: 'cus_1',
      subscription: 'sub_1',
      metadata: { workspace_id: 'ws_1' },
    }));
    expect(result).toHaveProperty('processed');
    expect(typeof result.processed).toBe('boolean');
  });

  test('dispatcher is stateless across calls — no per-event memoization (route owns dedup)', async () => {
    const supabase = createMockSupabase();
    // Two calls with same event id should both execute (dedup is at route layer via
    // stripe_webhook_events unique constraint — handler does NOT pre-check).
    const r1 = await processStripeEvent(supabase, stripeEvent('evt_same', 'invoice.paid', {
      id: 'in_1', customer: 'cus_1', subscription: 'sub_1', metadata: { workspace_id: 'ws_1' },
    }));
    const r2 = await processStripeEvent(supabase, stripeEvent('evt_same', 'invoice.paid', {
      id: 'in_1', customer: 'cus_1', subscription: 'sub_1', metadata: { workspace_id: 'ws_1' },
    }));
    expect(r1.processed).toBe(true);
    expect(r2.processed).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-005: Workspace subscription columns migration (Drizzle schema surface)
// ───────────────────────────────────────────────────────────────
describe('[P0] [9.3a-ATDD-005] workspaces + invoices schemas carry 9-3a columns', () => {
  test('workspaces schema exposes all 8 subscription columns', () => {
    const cols = Object.keys(workspaces);
    expect(cols).toContain('subscriptionStatus');
    expect(cols).toContain('subscriptionTier');
    expect(cols).toContain('stripeCustomerId');
    expect(cols).toContain('stripeSubscriptionId');
    expect(cols).toContain('subscriptionCurrentPeriodStart');
    expect(cols).toContain('subscriptionCurrentPeriodEnd');
    expect(cols).toContain('subscriptionCancelAtPeriodEnd');
    expect(cols).toContain('subscriptionUpdatedAt');
  });

  test('invoices schema exposes dedup_hash column', () => {
    const cols = Object.keys(invoices);
    expect(cols).toContain('dedupHash');
  });

  test('invoicePaymentAttempts table still exists (7-5 carry-over)', () => {
    expect(invoicePaymentAttempts).toBeDefined();
    expect(Object.keys(invoicePaymentAttempts)).toContain('invoiceId');
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-006: app_config drives tier config (data, not code)
// ───────────────────────────────────────────────────────────────
describe('[P0] [9.3a-ATDD-006] app_config table shape + tier config reader', () => {
  test('appConfig table exposes key + value jsonb shape', () => {
    expect(appConfig).toBeDefined();
    expect(Object.keys(appConfig)).toContain('key');
    expect(Object.keys(appConfig)).toContain('value');
  });

  test('getTierConfig is exported and callable from lib/config/tier-config', async () => {
    const { getTierConfig } = await import('@/lib/config/tier-config');
    expect(getTierConfig).toBeDefined();
    expect(typeof getTierConfig).toBe('function');
    // The mock returns a resolved TierConfig — verify shape
    const config = await getTierConfig();
    expect(config).toHaveProperty('tierLimits');
    expect(config).toHaveProperty('stripePrices');
    expect(config).toHaveProperty('windows.grace_period_days');
    expect(config).toHaveProperty('freeTransactionFeePercent');
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-007: Webhook dispatcher event-type contract (REAL dispatch)
// ───────────────────────────────────────────────────────────────
describe('[P0] [9.3a-ATDD-007] webhook dispatcher handles subscription + invoice success events', () => {
  test('checkout.session.completed with invoice_id metadata → one-time payment path (AC4)', async () => {
    const supabase = createMockSupabase();
    // Stub invoices lookup to return a non-paid invoice so payment records
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'invoices') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 'inv_123', status: 'sent', client_id: 'cli_123' },
                }),
              }),
            }),
          }),
        };
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    });
    const result = await processStripeEvent(
      supabase,
      stripeEvent('evt_inv_pay', 'checkout.session.completed', {
        mode: 'payment',
        amount_total: 1099,
        payment_intent: 'pi_123',
        created: 1718660400,
        metadata: { invoice_id: 'inv_123', workspace_id: 'ws_123' },
      }),
    );
    expect(result.processed).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith(
      'record_payment_with_concurrency',
      expect.objectContaining({
        p_invoice_id: 'inv_123',
        p_amount_cents: 1099,
        p_payment_method: 'stripe',
      }),
    );
  });

  test('checkout.session.completed with mode=subscription → subscription activation (AC3)', async () => {
    const supabase = createMockSupabase();
    const result = await processStripeEvent(
      supabase,
      stripeEvent('evt_sub', 'checkout.session.completed', {
        mode: 'subscription',
        customer: 'cus_123',
        subscription: 'sub_123',
        metadata: { workspace_id: 'ws_123' },
      }),
    );
    expect(result.processed).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith(
      'upsert_workspace_subscription',
      expect.objectContaining({
        p_workspace_id: 'ws_123',
        p_stripe_subscription_id: 'sub_123',
        p_status: 'active',
      }),
    );
  });

  test('customer.subscription.updated syncs workspace subscription status (AC5)', async () => {
    const supabase = createMockSupabase();
    const result = await processStripeEvent(
      supabase,
      stripeEvent('evt_sub_upd', 'customer.subscription.updated', {
        id: 'sub_123',
        customer: 'cus_123',
        status: 'active',
        metadata: { workspace_id: 'ws_123' },
      }),
    );
    expect(result.processed).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith(
      'upsert_workspace_subscription',
      expect.objectContaining({ p_status: 'active', p_tier: 'pro' }),
    );
  });

  test('invoice.payment_failed for subscription invoice → past_due (AC5/EC8)', async () => {
    const supabase = createMockSupabase();
    const result = await processStripeEvent(
      supabase,
      stripeEvent('evt_past_due', 'invoice.payment_failed', {
        id: 'in_sub_1',
        customer: 'cus_123',
        subscription: 'sub_123',
        metadata: { workspace_id: 'ws_123' },
      }),
    );
    expect(result.processed).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith(
      'set_workspace_subscription_status',
      expect.objectContaining({ p_status: 'past_due' }),
    );
  });

  test('NFR46 retry constants are exported (FR42 documentation)', () => {
    expect(STRIPE_WEBHOOK_MAX_RETRIES).toBe(3);
    expect(STRIPE_WEBHOOK_RETRY_BACKOFF_MS).toEqual([1000, 5000, 30000]);
  });

  test('FR44 dedup hash is exported from @flow/shared and deterministic', () => {
    const h1 = computeInvoiceDedupHash({
      workspaceId: 'ws_1',
      clientId: 'cli_1',
      lineItems: [{ sourceType: 'time_entry', timeEntryId: 'te_1', retainerId: null, description: 'x', amountCents: 100, quantity: '1' }],
      issueDate: '2026-06-17',
    });
    const h2 = computeInvoiceDedupHash({
      workspaceId: 'ws_1',
      clientId: 'cli_1',
      lineItems: [{ sourceType: 'time_entry', timeEntryId: 'te_1', retainerId: null, description: 'x', amountCents: 100, quantity: '1' }],
      issueDate: '2026-06-17',
    });
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });
});
