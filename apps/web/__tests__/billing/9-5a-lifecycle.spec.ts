/**
 * Story 9.5a Unit Tests — Subscription Lifecycle State Machine (RED PHASE)
 *
 * These tests fail until the implementation exports the required symbols and
 * behaviors. They cover the pure transition map, Stripe status mapping,
 * reconciliation/sweep contracts, and the Server Action wrapper.
 *
 * FR59, FR42, NFR54
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  transitionSubscriptionStatus,
  isTerminalStatus,
  SUBSCRIPTION_TRANSITIONS,
  mapStripeStatusToDb,
  GRACE_PERIOD_DAYS,
  SUSPENSION_MAX_DAYS,
} from '@flow/shared';
import { ReconciliationReportSchema } from '@flow/types';
import {
  runGraceSweep,
  runSuspensionSweep,
  runReconciliation,
} from '@flow/agents';
import { createServiceClient } from '@flow/db';
import { reconcileSubscriptionsAction } from '@/lib/actions/billing/reconcile-subscriptions';
import { getServerSupabase } from '@/lib/supabase-server';
import type { SupabaseClient } from '@supabase/supabase-js';

// ── Boundary mocks ──
vi.mock('@flow/db', async () => {
  const actual = await vi.importActual<typeof import('@flow/db')>('@flow/db');
  return { ...actual, createServiceClient: vi.fn() };
});

vi.mock('@flow/agents', async () => {
  const actual =
    await vi.importActual<typeof import('@flow/agents')>('@flow/agents');
  return {
    ...actual,
    writeAuditLog:
      vi.fn<
        (typeof import('@flow/agents/shared/audit-writer'))['writeAuditLog']
      >(),
  };
});

vi.mock('@flow/agents/shared/audit-writer', () => ({
  writeAuditLog: vi.fn(),
}));

vi.mock('@flow/agents/providers', () => ({
  getPaymentProvider: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));
vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

const { writeAuditLog } = await vi.importMock<
  typeof import('@flow/agents/shared/audit-writer')
>('@flow/agents/shared/audit-writer');
const { getPaymentProvider } = await vi.importMock<
  typeof import('@flow/agents/providers')
>('@flow/agents/providers');

beforeEach(() => {
  vi.clearAllMocks();
});

function mockServiceClient(chain: unknown) {
  vi.mocked(createServiceClient).mockReturnValue(
    chain as ReturnType<typeof createServiceClient>,
  );
}

// ─────────────────────────────────────────────────────────────────
// 1. Pure transition map (AC2)
// ─────────────────────────────────────────────────────────────────
describe('subscription lifecycle transitions', () => {
  const allowed = [
    ['free', 'active'],
    ['active', 'past_due'],
    ['active', 'suspended'],
    ['active', 'cancelled'],
    ['past_due', 'suspended'],
    ['past_due', 'active'],
    ['suspended', 'deleted'],
    ['suspended', 'active'],
    ['cancelled', 'suspended'],
  ] as const;

  test.each(allowed)('%s → %s is allowed', (from, to) => {
    const result = transitionSubscriptionStatus(from, to);
    expect(result.ok).toBe(true);
  });

  const disallowed = [
    ['active', 'deleted'],
    ['active', 'free'],
    ['past_due', 'deleted'],
    ['past_due', 'cancelled'],
    ['free', 'suspended'],
    ['free', 'deleted'],
    ['free', 'cancelled'],
    ['free', 'past_due'],
    ['suspended', 'past_due'],
    ['suspended', 'cancelled'],
    ['suspended', 'free'],
    ['cancelled', 'active'],
    ['cancelled', 'past_due'],
    ['cancelled', 'deleted'],
    ['cancelled', 'free'],
    ['deleted', 'active'],
    ['deleted', 'past_due'],
    ['deleted', 'suspended'],
    ['deleted', 'cancelled'],
    ['deleted', 'free'],
  ] as const;

  test.each(disallowed)('%s → %s is rejected', (from, to) => {
    const result = transitionSubscriptionStatus(from, to);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain('invalid_transition');
      expect(result.reason).toContain(from);
      expect(result.reason).toContain(to);
    }
  });
});

describe('isTerminalStatus', () => {
  test.each([
    ['free', false],
    ['active', false],
    ['past_due', false],
    ['cancelled', false],
    ['suspended', false],
    ['deleted', true],
  ] as const)('isTerminalStatus(%s) === %s', (status, expected) => {
    expect(isTerminalStatus(status)).toBe(expected);
  });
});

describe('SUBSCRIPTION_TRANSITIONS', () => {
  test('contains the failure lifecycle', () => {
    expect(SUBSCRIPTION_TRANSITIONS.active).toContain('past_due');
    expect(SUBSCRIPTION_TRANSITIONS.past_due).toContain('suspended');
    expect(SUBSCRIPTION_TRANSITIONS.suspended).toContain('deleted');
    expect(SUBSCRIPTION_TRANSITIONS.cancelled).toContain('suspended');
  });
});

// ─────────────────────────────────────────────────────────────────
// 2. Stripe status mapping (AC5, AC6)
// ─────────────────────────────────────────────────────────────────
describe('mapStripeStatusToDb', () => {
  test.each([
    ['active', 'active'],
    ['trialing', 'active'],
    ['canceled', 'cancelled'],
    ['past_due', 'past_due'],
    ['unpaid', 'suspended'],
    ['incomplete_expired', 'suspended'],
    ['incomplete', null],
    ['unknown', null],
  ] as const)('Stripe %s → DB %s', (stripe, db) => {
    expect(mapStripeStatusToDb(stripe)).toBe(db);
  });
});

// ─────────────────────────────────────────────────────────────────
// 3. Constants (AC3, AC4)
// ─────────────────────────────────────────────────────────────────
describe('lifecycle constants', () => {
  test('GRACE_PERIOD_DAYS is 7', () => {
    expect(GRACE_PERIOD_DAYS).toBe(7);
  });

  test('SUSPENSION_MAX_DAYS is 30', () => {
    expect(SUSPENSION_MAX_DAYS).toBe(30);
  });
});

// ─────────────────────────────────────────────────────────────────
// 4. Sweep logic (AC3, AC4)
// ─────────────────────────────────────────────────────────────────
function buildMockClient(overrides: {
  appConfig?: Array<{ key: string; value: string }>;
  workspaces?: Array<Record<string, unknown>>;
  rpcResult?: { error?: string; success?: boolean };
}) {
  const {
    appConfig = [],
    workspaces = [],
    rpcResult = { success: true },
  } = overrides;

  const fromMock = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    range: vi.fn().mockReturnThis(),
    data: workspaces,
    error: null,
  };

  const configMock = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    data: appConfig,
    error: null,
  };

  return {
    from: vi.fn((table: string) => {
      if (table === 'app_config') return configMock;
      if (table === 'workspaces') return fromMock;
      return fromMock;
    }),
    rpc: vi.fn().mockResolvedValue({ data: rpcResult, error: null }),
  } as unknown as ReturnType<typeof createServiceClient>;
}

describe('runGraceSweep', () => {
  test('transitions past_due workspaces older than grace days to suspended', async () => {
    const workspace = {
      id: 'ws-1',
      subscription_status: 'past_due',
      subscription_updated_at: '2026-06-09T00:00:00Z',
    };
    mockServiceClient(
      buildMockClient({
        appConfig: [
          { key: 'subscription_grace_period_days', value: '7' },
          { key: 'subscription_suspension_period_days', value: '30' },
        ],
        workspaces: [workspace],
        rpcResult: { success: true },
      }),
    );

    const result = await runGraceSweep();
    expect(result.swept).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.capped).toBe(false);
  });

  test('counts PRECONDITION_FAILED as swept without duplicate audit log', async () => {
    mockServiceClient(
      buildMockClient({
        appConfig: [{ key: 'subscription_grace_period_days', value: '7' }],
        workspaces: [
          {
            id: 'ws-1',
            subscription_status: 'past_due',
            subscription_updated_at: '2026-06-09T00:00:00Z',
          },
        ],
        rpcResult: { error: 'PRECONDITION_FAILED' },
      }),
    );

    const result = await runGraceSweep();
    expect(result.swept).toBe(1);
    // No `subscription.transitioned` audit log for the PRECONDITION_FAILED row
    // (the actual transitioner — webhook/reconcile — already logged it).
    const transitionCalls = (
      writeAuditLog as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.filter((call: unknown[]) => {
      const p = call[0] as { action?: string } | undefined;
      return p?.action === 'subscription.transitioned';
    });
    expect(transitionCalls).toHaveLength(0);
  });

  test('isolates per-row errors (EC8)', async () => {
    mockServiceClient(
      buildMockClient({
        appConfig: [{ key: 'subscription_grace_period_days', value: '7' }],
        workspaces: [
          {
            id: 'ws-1',
            subscription_status: 'past_due',
            subscription_updated_at: '2026-06-09T00:00:00Z',
          },
          {
            id: 'ws-2',
            subscription_status: 'past_due',
            subscription_updated_at: '2026-06-09T00:00:00Z',
          },
        ],
        rpcResult: { success: true },
      }),
    );

    const rpcMock = vi.fn();
    rpcMock.mockRejectedValueOnce(new Error('db error'));
    rpcMock.mockResolvedValueOnce({
      data: { success: true },
      error: null,
    });
    vi.mocked(createServiceClient).mockReturnValue({
      ...buildMockClient({
        appConfig: [{ key: 'subscription_grace_period_days', value: '7' }],
        workspaces: [
          {
            id: 'ws-1',
            subscription_status: 'past_due',
            subscription_updated_at: '2026-06-09T00:00:00Z',
          },
          {
            id: 'ws-2',
            subscription_status: 'past_due',
            subscription_updated_at: '2026-06-09T00:00:00Z',
          },
        ],
        rpcResult: { success: true },
      }),
      rpc: rpcMock,
    } as unknown as ReturnType<typeof createServiceClient>);

    const result = await runGraceSweep();
    expect(result.swept).toBe(1);
    expect(result.failed).toBe(1);
  });
});

describe('runSuspensionSweep', () => {
  test('transitions suspended workspaces older than suspension window to deleted', async () => {
    mockServiceClient(
      buildMockClient({
        appConfig: [
          { key: 'subscription_suspension_period_days', value: '30' },
        ],
        workspaces: [
          {
            id: 'ws-1',
            subscription_status: 'suspended',
            subscription_updated_at: '2026-05-19T00:00:00Z',
          },
        ],
        rpcResult: { success: true },
      }),
    );

    const result = await runSuspensionSweep();
    expect(result.swept).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────
// 5. Reconciliation (AC6)
// ─────────────────────────────────────────────────────────────────
describe('runReconciliation', () => {
  test('returns empty drift when Stripe status matches DB', async () => {
    mockServiceClient(
      buildMockClient({
        workspaces: [
          {
            id: 'ws-1',
            subscription_status: 'active',
            stripe_subscription_id: 'sub_1',
          },
        ],
      }),
    );
    (getPaymentProvider as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      {
        getSubscription: vi.fn().mockResolvedValue({ status: 'active' }),
      },
    );

    const report = await runReconciliation();
    expect(report.checked).toBe(1);
    expect(report.drift).toEqual([]);
    expect(report.uncorrectable).toEqual([]);
  });

  test('corrects drift when Stripe and DB disagree', async () => {
    mockServiceClient(
      buildMockClient({
        workspaces: [
          {
            id: 'ws-1',
            subscription_status: 'active',
            stripe_subscription_id: 'sub_1',
          },
        ],
        rpcResult: { success: true },
      }),
    );
    (getPaymentProvider as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      {
        getSubscription: vi.fn().mockResolvedValue({ status: 'past_due' }),
      },
    );

    const report = await runReconciliation();
    expect(report.checked).toBe(1);
    expect(report.drift).toHaveLength(1);
    expect(report.drift[0]).toMatchObject({
      workspaceId: 'ws-1',
      fromStatus: 'active',
      toStatus: 'past_due',
      corrected: true,
    });
  });

  test('excludes deleted workspaces from reconciliation', async () => {
    mockServiceClient(
      buildMockClient({
        workspaces: [
          {
            id: 'ws-1',
            subscription_status: 'deleted',
            stripe_subscription_id: 'sub_1',
          },
        ],
      }),
    );

    const report = await runReconciliation();
    expect(report.checked).toBe(0);
    expect(getPaymentProvider).not.toHaveBeenCalled();
  });

  test('reports Stripe API errors as uncorrectable (EC9)', async () => {
    mockServiceClient(
      buildMockClient({
        workspaces: [
          {
            id: 'ws-1',
            subscription_status: 'active',
            stripe_subscription_id: 'sub_1',
          },
        ],
      }),
    );
    (getPaymentProvider as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      {
        getSubscription: vi.fn().mockRejectedValue(new Error('Stripe outage')),
      },
    );

    const report = await runReconciliation();
    expect(report.uncorrectable).toHaveLength(1);
    expect(report.uncorrectable[0]).toMatchObject({
      workspaceId: 'ws-1',
      reason: 'stripe_api_error',
    });
  });

  test('reports invalid transitions as uncorrectable (EC4)', async () => {
    mockServiceClient(
      buildMockClient({
        workspaces: [
          {
            id: 'ws-1',
            subscription_status: 'free',
            stripe_subscription_id: 'sub_1',
          },
        ],
      }),
    );
    (getPaymentProvider as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      {
        getSubscription: vi.fn().mockResolvedValue({ status: 'deleted' }),
      },
    );

    const report = await runReconciliation();
    expect(report.uncorrectable).toHaveLength(1);
    expect(report.uncorrectable[0]).toMatchObject({
      workspaceId: 'ws-1',
      reason: 'invalid_transition',
    });
  });

  test('reports PRECONDITION_FAILED as drift corrected:false (EC1/EC3)', async () => {
    mockServiceClient(
      buildMockClient({
        workspaces: [
          {
            id: 'ws-1',
            subscription_status: 'active',
            stripe_subscription_id: 'sub_1',
          },
        ],
        rpcResult: { error: 'PRECONDITION_FAILED' },
      }),
    );
    (getPaymentProvider as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      {
        getSubscription: vi.fn().mockResolvedValue({ status: 'suspended' }),
      },
    );

    const report = await runReconciliation();
    expect(report.drift).toHaveLength(1);
    expect(report.drift[0]).toMatchObject({
      workspaceId: 'ws-1',
      fromStatus: 'active',
      toStatus: 'suspended',
      corrected: false,
    });
  });
});

// ─────────────────────────────────────────────────────────────────
// 6. Server Action wrapper (AC6)
// ─────────────────────────────────────────────────────────────────
describe('reconcileSubscriptionsAction', () => {
  function mockServerSupabase(overrides?: { role?: string }) {
    const role = overrides?.role ?? 'owner';
    vi.mocked(getServerSupabase).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: 'user-1',
              app_metadata: {
                workspace_id: '00000000-0000-0000-0000-000000000001',
                role,
              },
            },
          },
          error: null,
        }),
      },
      rpc: vi.fn(),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi
          .fn()
          .mockResolvedValue({ data: { id: 'ws-1', role }, error: null }),
      }),
    } as unknown as SupabaseClient);
  }

  test('delegates to runReconciliation and wraps in ActionResult', async () => {
    mockServerSupabase({ role: 'owner' });
    vi.spyOn(
      await import('@flow/agents'),
      'runReconciliation',
    ).mockResolvedValueOnce({ checked: 0, drift: [], uncorrectable: [] });

    const result = await reconcileSubscriptionsAction();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ checked: 0, drift: [], uncorrectable: [] });
    }
  });
});

// ─────────────────────────────────────────────────────────────────
// 7. Report schema contract (AC6)
// ─────────────────────────────────────────────────────────────────
describe('ReconciliationReportSchema', () => {
  test('accepts a valid report', () => {
    const report = {
      checked: 2,
      drift: [
        {
          workspaceId: 'ws-1',
          fromStatus: 'active',
          toStatus: 'past_due',
          corrected: true,
        },
      ],
      uncorrectable: [{ workspaceId: 'ws-2', reason: 'stripe_api_error' }],
    };
    expect(() => ReconciliationReportSchema.parse(report)).not.toThrow();
  });

  test('rejects an invalid report', () => {
    expect(() => ReconciliationReportSchema.parse({ checked: 'two' })).toThrow(
      z.ZodError,
    );
  });
});
