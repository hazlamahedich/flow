/**
 * Story 9.5a Acceptance Tests — Subscription Lifecycle State Machine (RED PHASE)
 * Tests lifecycle transitions Active→Past Due→Suspended→Deleted, grace period,
 * suspension enforcement, and reconciliation job.
 *
 * FR59, FR42
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { subscriptionStatusSchema } from '@flow/types';
import {
  transitionSubscriptionStatus,
  isTerminalStatus,
  SUBSCRIPTION_TRANSITIONS,
  GRACE_PERIOD_DAYS,
  SUSPENSION_MAX_DAYS,
} from '@flow/shared';
import { reconcileSubscriptionsAction } from '@/lib/actions/billing/reconcile-subscriptions';

vi.mock('@flow/agents', () => ({ runReconciliation: vi.fn() }));
vi.mock('@flow/db', async () => {
  const actual = await vi.importActual<typeof import('@flow/db')>('@flow/db');
  return {
    ...actual,
    requireTenantContext: vi.fn(),
    createFlowError: actual.createFlowError,
  };
});
vi.mock('@/lib/supabase-server', () => ({ getServerSupabase: vi.fn() }));
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

const { runReconciliation } = await import('@flow/agents');
const { getServerSupabase } = await import('@/lib/supabase-server');

beforeEach(() => vi.clearAllMocks());

// ───────────────────────────────────────────────────────────────
// ATDD-001: Lifecycle states defined (FR59)
// ───────────────────────────────────────────────────────────────
describe('[P0] [9.5a-ATDD-001] subscription lifecycle states defined (FR59)', () => {
  test('subscriptionStatusSchema accepts all six statuses', () => {
    expect(subscriptionStatusSchema.safeParse('free').success).toBe(true);
    expect(subscriptionStatusSchema.safeParse('active').success).toBe(true);
    expect(subscriptionStatusSchema.safeParse('past_due').success).toBe(true);
    expect(subscriptionStatusSchema.safeParse('cancelled').success).toBe(true);
    expect(subscriptionStatusSchema.safeParse('suspended').success).toBe(true);
    expect(subscriptionStatusSchema.safeParse('deleted').success).toBe(true);
  });

  test('subscriptionStatusSchema rejects unknown status', () => {
    expect(subscriptionStatusSchema.safeParse('expired').success).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-002: Valid transitions (FR59)
// ───────────────────────────────────────────────────────────────
describe('[P0] [9.5a-ATDD-002] lifecycle follows Active → Past Due → Suspended → Deleted', () => {
  test('active → past_due is a valid transition', () => {
    expect(transitionSubscriptionStatus('active', 'past_due').ok).toBe(true);
  });

  test('active → suspended is a valid transition (subscription ended by Stripe)', () => {
    expect(transitionSubscriptionStatus('active', 'suspended').ok).toBe(true);
  });

  test('active → cancelled is a valid transition (owner schedules cancel-at-period-end)', () => {
    expect(transitionSubscriptionStatus('active', 'cancelled').ok).toBe(true);
  });

  test('past_due → suspended is a valid transition (after grace)', () => {
    expect(transitionSubscriptionStatus('past_due', 'suspended').ok).toBe(true);
  });

  test('past_due → active is valid on payment recovery within grace', () => {
    expect(transitionSubscriptionStatus('past_due', 'active').ok).toBe(true);
  });

  test('suspended → deleted is a valid transition (after 30 days)', () => {
    expect(transitionSubscriptionStatus('suspended', 'deleted').ok).toBe(true);
  });

  test('suspended → active is valid on reactivation (payment recovered)', () => {
    expect(transitionSubscriptionStatus('suspended', 'active').ok).toBe(true);
  });

  test('cancelled → suspended is valid when cancel-at-period-end subscription ends', () => {
    expect(transitionSubscriptionStatus('cancelled', 'suspended').ok).toBe(
      true,
    );
  });

  test('free → active is valid on first subscription', () => {
    expect(transitionSubscriptionStatus('free', 'active').ok).toBe(true);
  });

  test('active → deleted direct jump is INVALID', () => {
    expect(transitionSubscriptionStatus('active', 'deleted').ok).toBe(false);
  });

  test('deleted is terminal (no further transitions)', () => {
    expect(isTerminalStatus('deleted')).toBe(true);
    expect(transitionSubscriptionStatus('deleted', 'active').ok).toBe(false);
  });

  test('SUBSCRIPTION_TRANSITIONS map contains the failure lifecycle', () => {
    expect(SUBSCRIPTION_TRANSITIONS.active).toContain('past_due');
    expect(SUBSCRIPTION_TRANSITIONS.past_due).toContain('suspended');
    expect(SUBSCRIPTION_TRANSITIONS.suspended).toContain('deleted');
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-003: Grace period constants (FR59)
// ───────────────────────────────────────────────────────────────
describe('[P0] [9.5a-ATDD-003] 7-day grace period before suspension (FR59)', () => {
  test('GRACE_PERIOD_DAYS default is 7', () => {
    expect(GRACE_PERIOD_DAYS).toBe(7);
  });

  test('active → past_due transition is allowed (entry to grace)', () => {
    expect(transitionSubscriptionStatus('active', 'past_due').ok).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-004: Suspension window constants (FR59)
// ───────────────────────────────────────────────────────────────
describe('[P0] [9.5a-ATDD-004] 30-day suspended window before deletion (FR59)', () => {
  test('SUSPENSION_MAX_DAYS default is 30', () => {
    expect(SUSPENSION_MAX_DAYS).toBe(30);
  });

  test('suspended is not a terminal status', () => {
    expect(isTerminalStatus('suspended')).toBe(false);
  });

  test('suspended → deleted transition is allowed (entry to deletion window)', () => {
    expect(transitionSubscriptionStatus('suspended', 'deleted').ok).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-005: Reconciliation job (split-brain correction)
// ───────────────────────────────────────────────────────────────
describe('[P0] [9.5a-ATDD-005] nightly reconciliation corrects Stripe/Supabase drift', () => {
  test('reconcileSubscriptionsAction is defined and callable', () => {
    expect(reconcileSubscriptionsAction).toBeDefined();
    expect(typeof reconcileSubscriptionsAction).toBe('function');
  });

  test('reconciliation returns a success result with a drift array', async () => {
    vi.mocked(runReconciliation).mockResolvedValueOnce({
      checked: 0,
      drift: [],
      uncorrectable: [],
    });
    const result = await reconcileSubscriptionsAction();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Array.isArray(result.data.drift)).toBe(true);
      expect(result.data.uncorrectable).toEqual([]);
    }
  });

  test('reconciliation reports drift when Stripe and DB disagree', async () => {
    const report = {
      checked: 1,
      drift: [
        {
          workspaceId: 'ws-1',
          fromStatus: 'active',
          toStatus: 'suspended',
          corrected: true,
        },
      ],
      uncorrectable: [],
    };
    vi.mocked(runReconciliation).mockResolvedValueOnce(report);
    const result = await reconcileSubscriptionsAction();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.drift).toHaveLength(1);
      expect(result.data.drift[0]?.corrected).toBe(true);
    }
  });

  test('reconciliation relies on transitionSubscriptionStatus for conditional-write validation', () => {
    expect(transitionSubscriptionStatus).toBeDefined();
    expect(transitionSubscriptionStatus('active', 'suspended').ok).toBe(true);
    expect(transitionSubscriptionStatus('active', 'deleted').ok).toBe(false);
  });
});
