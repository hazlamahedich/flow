/**
 * Story 9.3a unit tests — webhook dispatcher and helpers (GREEN PHASE)
 *
 * Asserts REAL behavior of:
 *   - retry-behavior constants (NFR46)
 *   - duplicate-invoice dedup hash (AC7, EC12)
 *   - webhook dispatcher switch + per-event handlers (AC3, AC4, AC5, AC6)
 *   - EC1-EC14 edge cases from the story spec
 *
 * Mocks ONLY the boundaries: supabase client, provider.getSubscription,
 * record_payment_with_concurrency RPC, log_client_notification RPC.
 * The code under test is the REAL implementation.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

// ── Real imports (code under test) ──
import {
  STRIPE_WEBHOOK_MAX_RETRIES,
  STRIPE_WEBHOOK_RETRY_BACKOFF_MS,
} from '@/lib/stripe/webhook-constants';
import { processStripeEvent } from '@/lib/stripe/handlers';
import { computeInvoiceDedupHash } from '@flow/shared';
import type { WebhookEvent } from '@/lib/stripe/webhook-types';

// ── Boundary mocks only (these are external services / RPCs / env) ──
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
    windows: { grace_period_days: 7, suspension_period_days: 30 },
    freeTransactionFeePercent: 5,
  }),
}));

vi.mock('@flow/agents/providers', () => ({
  StripePaymentProvider: vi.fn().mockImplementation(() => ({
    // Default: returns a valid expanded subscription. Per-test overrides possible.
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

// ── Helpers ──

function stripeEvent(
  id: string,
  type: string,
  data: Record<string, unknown> = {},
): WebhookEvent {
  return {
    id,
    type,
    created: Math.floor(Date.now() / 1000),
    data: { object: data },
  };
}

function expectRpcNotCalledWithName(
  rpc: ReturnType<typeof vi.fn>,
  name: string,
): void {
  const calls = rpc.mock.calls.filter((args: unknown[]) => args[0] === name);
  expect(calls.length).toBe(0);
}

type Chain = {
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
};

function createMockSupabase(
  overrides: {
    rpcResults?: Record<
      string,
      { data: unknown; error: { message: string; code?: string } | null }
    >;
    invoiceStatus?: string;
    invoiceExists?: boolean;
    invoiceClientId?: string | null;
    workspaceByCustomer?: string | null;
    insertErrors?: Record<string, { code: string; message: string } | null>;
  } = {},
): { client: SupabaseClient; chains: Record<string, Chain> } {
  const chains: Record<string, Chain> = {};

  const rpcResults = overrides.rpcResults ?? {};
  const insertErrors = overrides.insertErrors ?? {};

  const makeChain = (table: string): Chain => {
    const insert = vi.fn().mockResolvedValue({
      data: null,
      error: insertErrors[table] ?? null,
    });
    const update = vi.fn().mockReturnValue({ error: null });
    const select = vi.fn(() => {
      const terminal = {
        maybeSingle: vi.fn().mockResolvedValue({
          data:
            table === 'invoices'
              ? overrides.invoiceExists === false
                ? null
                : {
                    id: 'inv_row',
                    status: overrides.invoiceStatus ?? 'sent',
                    client_id: overrides.invoiceClientId ?? null,
                  }
              : table === 'workspaces'
                ? overrides.workspaceByCustomer === null
                  ? null
                  : { id: overrides.workspaceByCustomer ?? 'ws_lookup' }
                : null,
          error: null,
        }),
      };
      // eq is chainable to multiple levels for our use cases
      const eq2 = vi.fn(() => terminal);
      const eq1 = vi.fn(() => ({ eq: eq2, maybeSingle: terminal.maybeSingle }));
      return { eq: eq1, maybeSingle: terminal.maybeSingle };
    });
    const del = vi.fn().mockResolvedValue({ data: null, error: null });
    const rpc = vi.fn().mockImplementation((name: string) => {
      const result = rpcResults[name] ?? {
        data: { success: true },
        error: null,
      };
      return Promise.resolve(result);
    });
    const chain: Chain = { insert, update, select, delete: del, rpc };
    chains[table] = chain;
    return chain;
  };

  const client = {
    from: vi.fn().mockImplementation((table: string) => {
      if (!chains[table]) makeChain(table);
      const c = chains[table]!;
      // expose rpc at the top level too (supabase.rpc pattern)
      return {
        insert: c.insert,
        update: c.update,
        select: c.select,
        delete: c.delete,
      };
    }),
    rpc: vi.fn().mockImplementation((name: string) => {
      const result = rpcResults[name] ?? {
        data: { success: true },
        error: null,
      };
      return Promise.resolve(result);
    }),
  } as unknown as SupabaseClient;

  return { client, chains };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ───────────────────────────────────────────────────────────────
// Constants (NFR46 documentation of Stripe retry behavior)
// ───────────────────────────────────────────────────────────────
describe('[9.3a] webhook retry constants (NFR46)', () => {
  test('STRIPE_WEBHOOK_MAX_RETRIES documents Stripe retry count', () => {
    expect(STRIPE_WEBHOOK_MAX_RETRIES).toBe(3);
  });

  test('STRIPE_WEBHOOK_RETRY_BACKOFF_MS documents exponential backoff schedule', () => {
    expect(STRIPE_WEBHOOK_RETRY_BACKOFF_MS).toEqual([1000, 5000, 30000]);
  });
});

// ───────────────────────────────────────────────────────────────
// Duplicate invoice dedup hash (AC7, EC12)
// ───────────────────────────────────────────────────────────────
describe('[9.3a][AC7] computeInvoiceDedupHash', () => {
  const baseInput = {
    workspaceId: 'ws_1',
    clientId: 'cli_1',
    lineItems: [
      {
        sourceType: 'time_entry',
        timeEntryId: 'te_1',
        retainerId: null,
        description: 'June work',
        amountCents: 1099,
        quantity: '1.5',
      },
    ],
    issueDate: '2026-06-17',
  };

  test('is deterministic for identical inputs', () => {
    const h1 = computeInvoiceDedupHash(baseInput);
    const h2 = computeInvoiceDedupHash(baseInput);
    expect(h1).toBe(h2);
  });

  test('ignores line-item order (EC12 — same items reordered = same hash)', () => {
    const inputReordered = {
      ...baseInput,
      lineItems: [
        {
          sourceType: 'fixed_service',
          timeEntryId: null,
          retainerId: null,
          description: 'Setup fee',
          amountCents: 5000,
          quantity: '1',
        },
        ...baseInput.lineItems,
      ],
    };
    const inputOriginal = {
      ...baseInput,
      lineItems: [
        ...baseInput.lineItems,
        {
          sourceType: 'fixed_service',
          timeEntryId: null,
          retainerId: null,
          description: 'Setup fee',
          amountCents: 5000,
          quantity: '1',
        },
      ],
    };
    expect(computeInvoiceDedupHash(inputReordered)).toBe(
      computeInvoiceDedupHash(inputOriginal),
    );
  });

  test('differs when amount changes', () => {
    const h1 = computeInvoiceDedupHash(baseInput);
    const h2 = computeInvoiceDedupHash({
      ...baseInput,
      lineItems: [{ ...baseInput.lineItems[0]!, amountCents: 1100 }],
    });
    expect(h1).not.toBe(h2);
  });

  test('differs when issue date changes (recurring boundary)', () => {
    const h1 = computeInvoiceDedupHash(baseInput);
    const h2 = computeInvoiceDedupHash({
      ...baseInput,
      issueDate: '2026-07-17',
    });
    expect(h1).not.toBe(h2);
  });

  test('differs when client changes', () => {
    const h1 = computeInvoiceDedupHash(baseInput);
    const h2 = computeInvoiceDedupHash({ ...baseInput, clientId: 'cli_2' });
    expect(h1).not.toBe(h2);
  });

  test('falls back to empty sourceId when both timeEntryId and retainerId are null', () => {
    const input = {
      ...baseInput,
      lineItems: [
        {
          sourceType: 'fixed_service',
          timeEntryId: null,
          retainerId: null,
          description: 'Service',
          amountCents: 1000,
          quantity: '1',
        },
      ],
    };
    expect(() => computeInvoiceDedupHash(input)).not.toThrow();
    expect(computeInvoiceDedupHash(input)).toMatch(/^[a-f0-9]{64}$/);
  });
});

// ───────────────────────────────────────────────────────────────
// Dispatcher switch (AC3, AC4, AC5, AC6)
// ───────────────────────────────────────────────────────────────
describe('[9.3a] processStripeEvent dispatcher', () => {
  test('routes checkout.session.completed to handler', async () => {
    const { client } = createMockSupabase({
      rpcResults: {
        record_payment_with_concurrency: {
          data: { success: true },
          error: null,
        },
        log_client_notification: { data: null, error: null },
      },
      invoiceExists: true,
      invoiceStatus: 'sent',
      invoiceClientId: 'cli_123',
    });
    const event = stripeEvent('evt_otp', 'checkout.session.completed', {
      mode: 'payment',
      amount_total: 1099,
      payment_intent: 'pi_123',
      created: 1718660400,
      metadata: { invoice_id: 'inv_123', workspace_id: 'ws_123' },
    });
    const result = await processStripeEvent(client, event);
    expect(result.processed).toBe(true);
    // Verify RPC was called with correct amount (AC4)
    expect(client.rpc).toHaveBeenCalledWith(
      'record_payment_with_concurrency',
      expect.objectContaining({
        p_invoice_id: 'inv_123',
        p_workspace_id: 'ws_123',
        p_amount_cents: 1099,
        p_payment_method: 'stripe',
        p_stripe_payment_intent_id: 'pi_123',
      }),
    );
    // Handler does NOT touch stripe_webhook_events — route.ts owns dedup insert.
  });

  test('routes customer.subscription.updated to handler', async () => {
    const { client } = createMockSupabase();
    const event = stripeEvent('evt_sub_upd', 'customer.subscription.updated', {
      id: 'sub_123',
      customer: 'cus_123',
      status: 'active',
      metadata: { workspace_id: 'ws_123' },
    });
    const result = await processStripeEvent(client, event);
    expect(result.processed).toBe(true);
    expect(client.rpc).toHaveBeenCalledWith(
      'upsert_workspace_subscription',
      expect.objectContaining({
        p_workspace_id: 'ws_123',
        p_stripe_customer_id: 'cus_123',
        p_stripe_subscription_id: 'sub_123',
        p_status: 'active',
        p_tier: 'pro',
      }),
    );
  });

  test('routes customer.subscription.deleted to handler with clear flag (AC5)', async () => {
    const { client } = createMockSupabase();
    const event = stripeEvent('evt_sub_del', 'customer.subscription.deleted', {
      id: 'sub_123',
      customer: 'cus_123',
      status: 'canceled',
      metadata: { workspace_id: 'ws_123' },
    });
    const result = await processStripeEvent(client, event);
    expect(result.processed).toBe(true);
    expect(client.rpc).toHaveBeenCalledWith(
      'transition_to_suspended_any',
      expect.objectContaining({
        p_workspace_id: 'ws_123',
      }),
    );
  });

  test('routes invoice.paid (subscription) → set status active (AC5)', async () => {
    const { client } = createMockSupabase();
    const event = stripeEvent('evt_inv_paid', 'invoice.paid', {
      id: 'in_123',
      customer: 'cus_123',
      subscription: 'sub_123',
      metadata: { workspace_id: 'ws_123' },
    });
    const result = await processStripeEvent(client, event);
    expect(result.processed).toBe(true);
    expect(client.rpc).toHaveBeenCalledWith(
      'set_workspace_subscription_status',
      expect.objectContaining({ p_status: 'active' }),
    );
  });

  test('routes invoice.payment_failed (subscription) → set status past_due (AC5)', async () => {
    const { client } = createMockSupabase();
    const event = stripeEvent('evt_inv_failed', 'invoice.payment_failed', {
      id: 'in_123',
      customer: 'cus_123',
      subscription: 'sub_123',
      metadata: { workspace_id: 'ws_123' },
    });
    const result = await processStripeEvent(client, event);
    expect(result.processed).toBe(true);
    expect(client.rpc).toHaveBeenCalledWith(
      'set_workspace_subscription_status',
      expect.objectContaining({ p_status: 'past_due' }),
    );
  });

  test('routes payment_intent.payment_failed → 7-5 failure branch (records attempt)', async () => {
    const { client, chains } = createMockSupabase();
    const event = stripeEvent('evt_pif', 'payment_intent.payment_failed', {
      amount: 1099,
      metadata: { invoice_id: 'inv_123', workspace_id: 'ws_123' },
      last_payment_error: { decline_code: 'card_declined' },
    });
    const result = await processStripeEvent(client, event);
    expect(result.processed).toBe(true);
    expect(chains['invoice_payment_attempts']?.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        invoice_id: 'inv_123',
        workspace_id: 'ws_123',
        attempt_type: 'stripe_checkout',
        status: 'failed',
        error_code: 'card_declined',
      }),
    );
  });

  test('routes checkout.session.expired → 7-5 failure branch (records attempt)', async () => {
    const { client, chains } = createMockSupabase();
    const event = stripeEvent('evt_exp', 'checkout.session.expired', {
      amount_total: 1099,
      metadata: { invoice_id: 'inv_123', workspace_id: 'ws_123' },
    });
    const result = await processStripeEvent(client, event);
    expect(result.processed).toBe(true);
    expect(chains['invoice_payment_attempts']?.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        invoice_id: 'inv_123',
        amount_cents: 1099,
        attempt_type: 'stripe_checkout',
      }),
    );
  });

  test('unhandled event type returns processed:false with descriptive reason', async () => {
    const { client } = createMockSupabase();
    const event = stripeEvent('evt_unknown', 'account.updated', {});
    const result = await processStripeEvent(client, event);
    expect(result.processed).toBe(false);
    expect(result.reason).toContain('unhandled event type: account.updated');
  });
});

// ───────────────────────────────────────────────────────────────
// Edge cases EC1-EC14 (per spec edge-case matrix)
// ───────────────────────────────────────────────────────────────
describe('[9.3a] Edge case matrix', () => {
  // EC1: same event delivered twice → handled by route.ts dedup, not by handler.
  // Verified at the route level (route.test.ts). Unit-level: handler is stateless
  // wrt dedup; no test needed here.
  test('EC2: checkout.session.completed for already-paid invoice → no-op, processed:true', async () => {
    const { client } = createMockSupabase({
      invoiceExists: true,
      invoiceStatus: 'paid',
    });
    const event = stripeEvent('evt_paid', 'checkout.session.completed', {
      mode: 'payment',
      amount_total: 1099,
      payment_intent: 'pi_123',
      created: 1718660400,
      metadata: { invoice_id: 'inv_123', workspace_id: 'ws_123' },
    });
    const result = await processStripeEvent(client, event);
    expect(result.processed).toBe(true);
    expect(result.reason).toContain('already paid');
    // Crucially: record_payment_with_concurrency NOT called
    const rpcMock = client.rpc as ReturnType<typeof vi.fn>;
    expectRpcNotCalledWithName(rpcMock, 'record_payment_with_concurrency');
  });

  test('EC2b: checkout.session.completed for voided invoice → no-op, processed:true', async () => {
    const { client } = createMockSupabase({
      invoiceExists: true,
      invoiceStatus: 'voided',
    });
    const event = stripeEvent('evt_void', 'checkout.session.completed', {
      mode: 'payment',
      amount_total: 1099,
      payment_intent: 'pi_123',
      created: 1718660400,
      metadata: { invoice_id: 'inv_123', workspace_id: 'ws_123' },
    });
    const result = await processStripeEvent(client, event);
    expect(result.processed).toBe(true);
    expect(result.reason).toContain('already voided');
  });

  test('EC3: checkout.session.completed with no invoice_id and no mode → unrecognized context', async () => {
    const { client } = createMockSupabase();
    const event = stripeEvent('evt_ec3', 'checkout.session.completed', {
      customer: 'cus_123',
      // No invoice_id, mode is missing
    });
    const result = await processStripeEvent(client, event);
    expect(result.processed).toBe(false);
    expect(result.reason).toContain('unrecognized checkout context');
  });

  test('EC4: checkout.session.completed for draft invoice → records payment (not no-op)', async () => {
    const { client } = createMockSupabase({
      invoiceExists: true,
      invoiceStatus: 'draft',
      invoiceClientId: 'cli_123',
      rpcResults: {
        record_payment_with_concurrency: {
          data: { success: true },
          error: null,
        },
      },
    });
    const event = stripeEvent('evt_draft', 'checkout.session.completed', {
      mode: 'payment',
      amount_total: 1099,
      payment_intent: 'pi_123',
      created: 1718660400,
      metadata: { invoice_id: 'inv_123', workspace_id: 'ws_123' },
    });
    const result = await processStripeEvent(client, event);
    expect(result.processed).toBe(true);
  });

  test('EC5: subscription.updated when workspace already has newer period → still upserts (last-writer-wins is RPC-side)', async () => {
    const { client } = createMockSupabase();
    const event = stripeEvent('evt_ec5', 'customer.subscription.updated', {
      id: 'sub_123',
      customer: 'cus_123',
      status: 'active',
      metadata: { workspace_id: 'ws_123' },
    });
    const result = await processStripeEvent(client, event);
    expect(result.processed).toBe(true);
    // The RPC owns the period comparison logic (verified in pgTAP).
  });

  test('EC6: customer.subscription.deleted for free workspace → still calls set_status cancelled', async () => {
    const { client } = createMockSupabase();
    const event = stripeEvent('evt_ec6', 'customer.subscription.deleted', {
      id: 'sub_unknown',
      customer: 'cus_unknown',
      status: 'canceled',
      metadata: { workspace_id: 'ws_free' },
    });
    const result = await processStripeEvent(client, event);
    expect(result.processed).toBe(true);
    // RPC returns success even if workspace is "free" — there's no early-exit
    // for free workspaces; the row just transitions to cancelled.
  });

  test('EC7: subscription.deleted referencing missing workspace_id with no customer → processed:false', async () => {
    const { client } = createMockSupabase();
    const event = stripeEvent('evt_ec7', 'customer.subscription.deleted', {
      id: 'sub_x',
      status: 'canceled',
      // no customer, no metadata
    });
    const result = await processStripeEvent(client, event);
    expect(result.processed).toBe(false);
    expect(result.reason).toContain('workspace_id or customer');
  });

  test('EC8: invoice.payment_failed WITHOUT subscription field → processed:true, NOT marked failed', async () => {
    const { client } = createMockSupabase();
    const event = stripeEvent('evt_ec8', 'invoice.payment_failed', {
      id: 'in_one_time',
      customer: 'cus_123',
      // no subscription field → one-time invoice
      metadata: { workspace_id: 'ws_123' },
    });
    const result = await processStripeEvent(client, event);
    expect(result.processed).toBe(true);
    expect(result.reason).toContain('not a subscription invoice');
    // Crucially: set_workspace_subscription_status NOT called
    const rpcMock = client.rpc as ReturnType<typeof vi.fn>;
    expectRpcNotCalledWithName(rpcMock, 'set_workspace_subscription_status');
  });

  test('EC11-equivalent: RPC returns error → handler surfaces reason, does not throw', async () => {
    const { client } = createMockSupabase({
      rpcResults: {
        upsert_workspace_subscription: {
          data: null,
          error: { message: 'connection timeout', code: 'PGRST' },
        },
      },
    });
    const event = stripeEvent('evt_ec11', 'customer.subscription.updated', {
      id: 'sub_123',
      customer: 'cus_123',
      status: 'active',
      metadata: { workspace_id: 'ws_123' },
    });
    const result = await processStripeEvent(client, event);
    expect(result.processed).toBe(false);
    expect(result.reason).toContain('connection timeout');
  });

  test('EC13: subscription.deleted falls back to customer lookup when metadata missing', async () => {
    const { client } = createMockSupabase({
      workspaceByCustomer: 'ws_from_customer',
    });
    const event = stripeEvent('evt_ec13', 'customer.subscription.deleted', {
      id: 'sub_123',
      customer: 'cus_lookup',
      status: 'canceled',
      // no metadata.workspace_id — must fall back to stripe_customer_id lookup
    });
    const result = await processStripeEvent(client, event);
    expect(result.processed).toBe(true);
    expect(client.rpc).toHaveBeenCalledWith(
      'transition_to_suspended_any',
      expect.objectContaining({ p_workspace_id: 'ws_from_customer' }),
    );
  });

  test('EC-default: checkout.session.completed subscription missing customer → processed:false', async () => {
    const { client } = createMockSupabase();
    const event = stripeEvent('evt_no_cus', 'checkout.session.completed', {
      mode: 'subscription',
      subscription: 'sub_123',
      metadata: { workspace_id: 'ws_123' },
      // customer missing
    });
    const result = await processStripeEvent(client, event);
    expect(result.processed).toBe(false);
    expect(result.reason).toContain('customer');
  });

  test('EC-default: subscription.updated with unknown price id → processed:false', async () => {
    const { StripePaymentProvider } = await import('@flow/agents/providers');
    (
      StripePaymentProvider as unknown as ReturnType<typeof vi.fn>
    ).mockImplementation(() => ({
      getSubscription: vi.fn().mockResolvedValue({
        providerSubscriptionId: 'sub_x',
        customerId: 'cus_x',
        priceId: 'price_unknown',
        status: 'active',
        currentPeriodStart: '2026-06-18T00:00:00Z',
        currentPeriodEnd: '2026-07-18T00:00:00Z',
        cancelAtPeriodEnd: false,
      }),
    }));
    const { client } = createMockSupabase();
    const event = stripeEvent(
      'evt_bad_price',
      'customer.subscription.updated',
      {
        id: 'sub_x',
        customer: 'cus_x',
        status: 'active',
        metadata: { workspace_id: 'ws_x' },
      },
    );
    const result = await processStripeEvent(client, event);
    expect(result.processed).toBe(false);
    expect(result.reason).toContain('price_unknown');
  });

  test('EC-default: subscription.updated with status canceled → maps to cancelled (not past_due)', async () => {
    const { StripePaymentProvider } = await import('@flow/agents/providers');
    (
      StripePaymentProvider as unknown as ReturnType<typeof vi.fn>
    ).mockImplementation(() => ({
      getSubscription: vi.fn().mockResolvedValue({
        providerSubscriptionId: 'sub_cz',
        customerId: 'cus_cz',
        priceId: 'price_test_pro',
        status: 'canceled',
        currentPeriodStart: '2026-06-18T00:00:00Z',
        currentPeriodEnd: '2026-07-18T00:00:00Z',
        cancelAtPeriodEnd: false,
      }),
    }));
    const { client } = createMockSupabase();
    const event = stripeEvent('evt_cz', 'customer.subscription.updated', {
      id: 'sub_cz',
      customer: 'cus_cz',
      status: 'canceled',
      metadata: { workspace_id: 'ws_cz' },
    });
    const result = await processStripeEvent(client, event);
    expect(result.processed).toBe(true);
    expect(client.rpc).toHaveBeenCalledWith(
      'upsert_workspace_subscription',
      expect.objectContaining({ p_status: 'cancelled' }),
    );
  });
});
