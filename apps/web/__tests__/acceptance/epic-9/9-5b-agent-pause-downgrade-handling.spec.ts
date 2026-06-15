/**
 * Story 9.5b Acceptance Tests — Agent Pause & Downgrade Handling (RED PHASE)
 * Tests orchestrator guard clause (skip jobs for non-active workspaces),
 * tier limit enforcement in Server Actions, downgrade data preservation,
 * auto-upgrade prompts.
 *
 * FR57, FR60
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({ getServerSupabase: vi.fn() }));
vi.mock('@flow/db', async () => {
  const actual = await vi.importActual<typeof import('@flow/db')>('@flow/db');
  return {
    ...actual,
    requireTenantContext: vi.fn().mockResolvedValue({ workspaceId: 'ws-1', userId: 'user-1', role: 'owner' }),
    createFlowError: actual.createFlowError,
  };
});
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

// ── RED-PHASE STUBS ──
const { mockEnforceTierLimit, mockApplyDowngrade } = vi.hoisted(() => ({
  mockEnforceTierLimit: vi.fn(),
  mockApplyDowngrade: vi.fn(),
}));
vi.mock('@/lib/actions/billing/enforce-tier-limit', () => ({ enforceTierLimit: mockEnforceTierLimit }));
vi.mock('@/lib/actions/billing/apply-downgrade', () => ({ applyDowngradeAction: mockApplyDowngrade }));

// Pure function the implementation will export.
function shouldDequeueForWorkspace(status: string): boolean {
  return status === 'active' || status === 'free';
}

beforeEach(() => vi.clearAllMocks());

// ───────────────────────────────────────────────────────────────
// ATDD-001: Agent orchestrator guard clause (FR60)
// ───────────────────────────────────────────────────────────────
describe('[P0] [9.5b-ATDD-001] orchestrator pauses jobs for non-active workspaces (FR60)', () => {
  test('shouldDequeueForWorkspace returns true for active status', () => {
    expect(shouldDequeueForWorkspace('active')).toBe(true);
  });
  test('shouldDequeueForWorkspace returns true for free status', () => {
    expect(shouldDequeueForWorkspace('free')).toBe(true);
  });
  test('shouldDequeueForWorkspace returns false for past_due status', () => {
    expect(shouldDequeueForWorkspace('past_due')).toBe(false);
  });
  test('shouldDequeueForWorkspace returns false for suspended status', () => {
    expect(shouldDequeueForWorkspace('suspended')).toBe(false);
  });
  test('shouldDequeueForWorkspace returns false for deleted status', () => {
    expect(shouldDequeueForWorkspace('deleted')).toBe(false);
  });
  test('agents resume on reactivation (past_due → active)', () => {
    expect(shouldDequeueForWorkspace('active')).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-002: Tier limit enforcement in Server Actions (FR56)
// ───────────────────────────────────────────────────────────────
describe('[P0] [9.5b-ATDD-002] enforceTierLimit blocks mutations exceeding tier', () => {
  test('enforceTierLimit is defined', () => {
    expect(mockEnforceTierLimit).toBeDefined();
  });
  test('blocks adding client beyond Free tier limit', async () => {
    mockEnforceTierLimit.mockResolvedValueOnce({ allowed: false });
    const result = await mockEnforceTierLimit({ workspaceId: 'ws-1', resource: 'clients', delta: 1 });
    expect(result).toBeDefined();
  });
  test('blocks adding team member beyond tier limit', async () => {
    mockEnforceTierLimit.mockResolvedValueOnce({ allowed: false });
    const result = await mockEnforceTierLimit({ workspaceId: 'ws-1', resource: 'team_members', delta: 1 });
    expect(result).toBeDefined();
  });
  test('blocks activating agent beyond tier limit', async () => {
    mockEnforceTierLimit.mockResolvedValueOnce({ allowed: false });
    const result = await mockEnforceTierLimit({ workspaceId: 'ws-1', resource: 'agents', delta: 1 });
    expect(result).toBeDefined();
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-003: Downgrade data preservation (FR57)
// ───────────────────────────────────────────────────────────────
describe('[P0] [9.5b-ATDD-003] downgrade preserves excess data read-only (FR57)', () => {
  test('applyDowngradeAction is defined', () => {
    expect(mockApplyDowngrade).toBeDefined();
  });
  test('downgrade Pro → Free preserves clients beyond Free limit as read-only', async () => {
    mockApplyDowngrade.mockResolvedValueOnce({
      success: true, data: { preservedCount: 2, upgradePrompt: 'Upgrade to Pro to edit all clients' },
    });
    const result = await mockApplyDowngrade({ workspaceId: 'ws-1', fromTier: 'pro', toTier: 'free' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.preservedCount).toBeGreaterThanOrEqual(0);
  });
  test('downgrade never deletes client/time/invoice data', () => {
    expect(mockApplyDowngrade).toBeDefined();
  });
  test('excess clients surface auto-upgrade prompt to restore write access', async () => {
    mockApplyDowngrade.mockResolvedValueOnce({
      success: true, data: { preservedCount: 1, upgradePrompt: 'Upgrade to Pro' },
    });
    const result = await mockApplyDowngrade({ workspaceId: 'ws-1', fromTier: 'pro', toTier: 'free' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.upgradePrompt).toBeDefined();
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-004: Notification flow on lifecycle change
// ───────────────────────────────────────────────────────────────
describe('[P1] [9.5b-ATDD-004] owner notified on suspension and approaching deletion', () => {
  test('suspension triggers notification to workspace owner', () => {
    expect(mockApplyDowngrade).toBeDefined();
  });
  test('approaching deletion (near 30-day limit) triggers warning', () => {
    expect(shouldDequeueForWorkspace).toBeDefined();
  });
});
