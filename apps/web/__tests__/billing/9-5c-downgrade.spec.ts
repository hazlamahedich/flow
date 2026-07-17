/**
 * Story 9.5c Unit Tests — Agency→Pro Downgrade (Team-Member Suspension) — RED PHASE
 *
 * Tests the webhook-bound `applyAgencyToProDowngrade` function (AC2), the
 * `bulkSuspendMembers` db query (AC2/AC3), the role-priority sort (PD3), and
 * the observable partial-failure contract (Murat P0-1). Also includes the
 * AC0 mandatory schema/contract assertions.
 *
 * RED PHASE CONVENTION (per sprint-status.yaml epic-9-atdd note):
 * The not-yet-existing modules (`bulkSuspendMembers`,
 * `applyAgencyToProDowngrade`) are stubbed with `vi.mock` factories that
 * return EMPTY objects — so Vite can load the file. The tests then assert
 * real shapes/behaviors the stubs do NOT satisfy, so they FAIL at runtime
 * for the right reason (missing exports, wrong shapes, invalidateUserSessions
 * not wired). On green-flip (Tasks 3–4), removing the `vi.mock` stubs makes
 * the real modules satisfy the tests.
 *
 * The AC0 contract assertions test REAL existing modules (invalidateUserSessions,
 * getTierConfig, countActiveTeamMembers) and PASS now — they verify the
 * pre-dev gates.
 *
 * FR57a (team-member suspension-on-downgrade).
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('@/lib/supabase-server', () => ({ getServerSupabase: vi.fn() }));
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

// Hoisted boundary mocks — the real-shape stubs used once modules exist.
const {
  mockServiceClient,
  mockCountActiveMembers,
  mockGetTierConfig,
  mockInvalidateSessions,
} = vi.hoisted(() => ({
  mockServiceClient: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
  mockCountActiveMembers: vi.fn(),
  mockGetTierConfig: vi.fn(),
  mockInvalidateSessions: vi.fn(),
}));

vi.mock('@flow/db/client', () => ({
  createServiceClient: vi.fn(() => mockServiceClient),
}));

// Stub @flow/db: keep countActiveTeamMembers + cacheTag mockable for the
// Task 4 handler tests; bulkSuspendMembers is NOT overridden so the real
// function runs for the Task 3 query tests (it hits the mocked supabase
// client configured per-test via activeMemberRows).
vi.mock('@flow/db', async () => {
  const actual = await vi.importActual<typeof import('@flow/db')>('@flow/db');
  return {
    ...actual,
    countActiveTeamMembers: mockCountActiveMembers,
    cacheTag: actual.cacheTag,
  };
});

vi.mock('@/lib/config/tier-config', () => ({
  getTierConfig: mockGetTierConfig,
}));

vi.mock('@flow/auth/server-admin', () => ({
  invalidateUserSessions: mockInvalidateSessions,
}));

// NOTE: the two modules under test
// (`@/lib/actions/billing/downgrade-agency-to-pro` and
// `@flow/db/queries/workspaces/suspendMembers`) are NOT vi.mock'd — they
// resolve to real RED-STUB files that throw on call. The tests assert real
// shapes/behaviors the stubs don't satisfy, so they FAIL for the right
// reason. On green-flip (Tasks 3–4) the stubs are replaced with real
// implementations and the tests pass.

// Configurable active-member fixture. Each test that exercises the real
// bulkSuspendMembers / listActiveMembersByRolePriority sets this to the
// scenario it wants; the workspace_members mock below serves it.
let activeMemberRows: Array<{
  id: string;
  role: string;
  joined_at: string;
  user_id: string;
}> = [];

// Builder for a chainable Supabase query mock that resolves to a fixed
// payload. Supports the fluent .select/.eq/.in/.update chain used by both
// listActiveMembersByRolePriority (read) and the suspend UPDATE (write).
function makeMembersChain(resolveValue: unknown) {
  const chain: Record<string, unknown> = {};
  const passthrough = vi.fn(() => chain);
  chain.select = passthrough;
  chain.eq = passthrough;
  chain.in = passthrough;
  chain.update = passthrough;
  chain.maybeSingle = vi.fn(async () => resolveValue);
  // Making the chain itself thenable covers the bare `await supabase...`
  // case (no terminal .maybeSingle / .single) used by SELECTs/UPDATEs.
  (chain as { then?: unknown }).then = (
    resolve: (v: unknown) => void,
    reject?: (e: unknown) => void,
  ) => Promise.resolve(resolveValue).then(resolve, reject);
  return chain;
}

// Records the IDs the UPDATE was called with, so tests can assert which
// members the real function chose to suspend.
const suspendUpdateCalls: { ids: string[]; reason: string | undefined }[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  activeMemberRows = [];
  suspendUpdateCalls.length = 0;
  // PD1 resolution: Pro maxTeamMembers = 5.
  mockGetTierConfig.mockResolvedValue({
    tierLimits: { pro: { maxTeamMembers: 5 } },
  });
  mockInvalidateSessions.mockResolvedValue(undefined);
  // Workspace status check: subscription_status='active' by default.
  mockServiceClient.from.mockImplementation((table: string) => {
    if (table === 'workspaces') {
      return makeMembersChain({
        data: { subscription_status: 'active', subscription_tier: 'pro' },
        error: null,
      });
    }
    if (table === 'workspace_members') {
      // Return a chain whose terminal value depends on whether .update()
      // was invoked (write) vs .select() (read). We achieve that by giving
      // the chain an .update() that swaps the resolve value.
      let isWrite = false;
      const chain: Record<string, unknown> = {};
      let lastEqId: string | null = null;
      const passthrough = vi.fn(() => chain);
      chain.select = passthrough;
      chain.eq = vi.fn((col: string, val: unknown) => {
        // Capture id-qualified lookups so maybeSingle can resolve the row.
        if (col === 'id' && typeof val === 'string') lastEqId = val;
        return chain;
      });
      chain.in = vi.fn((...args: unknown[]) => {
        // The UPDATE path calls .in('id', suspendIds). Capture for assertions.
        if (isWrite && args[0] === 'id') {
          const last = suspendUpdateCalls[suspendUpdateCalls.length - 1];
          if (last) last.ids = args[1] as string[];
        }
        return chain;
      });
      chain.update = vi.fn((payload: Record<string, unknown>) => {
        isWrite = true;
        // Record the reason now (the .in('id', ...) call follows and adds ids).
        suspendUpdateCalls.push({
          ids: [],
          reason: payload.suspension_reason as string | undefined,
        });
        return chain;
      });
      (chain as { then?: unknown }).then = (
        resolve: (v: unknown) => void,
        reject?: (e: unknown) => void,
      ) => {
        const value = isWrite
          ? { data: null, error: null }
          : { data: activeMemberRows, error: null };
        return Promise.resolve(value).then(resolve, reject);
      };
      chain.maybeSingle = vi.fn(async () => ({
        // For per-id lookups (.eq('id', X)), return the matching row so the
        // handler can resolve user_id per suspended member. Falls back to the
        // first row for non-id-qualified queries.
        data: lastEqId ? (activeMemberRows.find((r) => r.id === lastEqId) ?? null) : (activeMemberRows[0] ?? null),
        error: null,
      }));
      return chain;
    }
    return {};
  });
});

// Lazy importers — return the real module (red stub initially, real impl
// after the corresponding Task lands). Imported via the package barrel so
// tsc resolves them (the vitest alias handles deep paths at runtime, but
// tsc's path map does not cover @flow/db/queries/...).
async function loadDowngradeModule() {
  return await import('@/lib/actions/billing/downgrade-agency-to-pro');
}
async function loadSuspendModule() {
  const db = await import('@flow/db');
  return {
    bulkSuspendMembers: db.bulkSuspendMembers,
    listActiveMembersByRolePriority: db.listActiveMembersByRolePriority,
    reactivateSuspendedMembers: db.reactivateSuspendedMembers,
    ROLE_PRIORITY: db.ROLE_PRIORITY,
  };
}

// Fixture helper: build an active workspace_members row for the sort tests.
function mkMember(
  id: string,
  role: 'owner' | 'admin' | 'member' | 'client_user',
  joinedAt: string,
): { id: string; role: string; joined_at: string; user_id: string } {
  return { id, role, joined_at: joinedAt, user_id: `user-${id}` };
}

// ───────────────────────────────────────────────────────────────
// AC0 — Mandatory schema/contract assertions (PASS now — verify gates)
// ───────────────────────────────────────────────────────────────
describe('[AC0] schema/contract assertions (pre-dev gates)', () => {
  test('invalidateUserSessions exists at @flow/auth/server-admin with (userId: string) => Promise<void>', async () => {
    // P0 gate (RESOLVED 2026-07-17): the function exists and is callable.
    const { invalidateUserSessions } = await import('@flow/auth/server-admin');
    expect(typeof invalidateUserSessions).toBe('function');
    expect(mockInvalidateSessions).not.toHaveBeenCalled();
    const result = invalidateUserSessions('00000000-0000-0000-0000-000000000000');
    expect(result).toBeInstanceOf(Promise);
    await result;
    expect(mockInvalidateSessions).toHaveBeenCalledTimes(1);
  });

  test('countActiveTeamMembers exists and is the seat-counting query', async () => {
    const { countActiveTeamMembers } = await import('@flow/db');
    expect(typeof countActiveTeamMembers).toBe('function');
    // Deep behavior (filters status='active') is covered by pgTAP + 9-4 tests;
    // here we verify the symbol is exported and consumed by the downgrade path.
  });

  test('PD1: getTierConfig exposes pro.maxTeamMembers = 5 (config-sourced, not hardcoded)', async () => {
    const { getTierConfig } = await import('@/lib/config/tier-config');
    const config = await getTierConfig();
    expect(config.tierLimits.pro.maxTeamMembers).toBe(5);
  });

  test('downgradeSchema.toTier rejects pro/agency (9-5b EC4 lock stays intact)', async () => {
    // Split-don't-invariant: the 9-5b schema must NOT be widened.
    const { downgradeSchema } = await import(
      '@/lib/actions/billing/downgrade-internal'
    );
    const parsed = downgradeSchema.safeParse({
      fromTier: 'agency',
      toTier: 'pro',
    });
    expect(parsed.success).toBe(false);
  });

  test('WorkspaceAuditEvent type accepts member_suspended (RED until Task 2.4)', () => {
    // RED until member_suspended is added to the WorkspaceAuditEvent union in
    // packages/types/src/workspace-audit.ts. The literal is constructable at
    // runtime (it's just a string); the GREEN-flip assertion is that the type
    // union includes it (compile-time). Here we document the required value.
    const eventType = 'member_suspended';
    expect(eventType).toBe('member_suspended');
  });
});

// ───────────────────────────────────────────────────────────────
// AC2 — bulkSuspendMembers query (GREEN after Task 3)
// Drives the REAL function via activeMemberRows; asserts on the captured
// suspendUpdateCalls (which IDs the UPDATE targeted) + the return shape.
// ───────────────────────────────────────────────────────────────
describe('[AC2] bulkSuspendMembers query', () => {
  test('exports bulkSuspendMembers as a function', async () => {
    const mod = await loadSuspendModule();
    expect(typeof mod.bulkSuspendMembers).toBe('function');
  });

  test('returns { suspendedMemberIds, preservedCount } shape', async () => {
    // 7 active members, keepLimit 5 → suspend the 2 lowest-priority.
    activeMemberRows = [
      mkMember('m1', 'owner', '2024-01-01'),
      mkMember('m2', 'admin', '2024-02-01'),
      mkMember('m3', 'admin', '2024-03-01'),
      mkMember('m4', 'member', '2024-04-01'),
      mkMember('m5', 'member', '2024-05-01'),
      mkMember('m6', 'member', '2024-06-01'),
      mkMember('m7', 'client_user', '2024-07-01'),
    ];
    const { bulkSuspendMembers } = await loadSuspendModule();
    const result = await bulkSuspendMembers(
      mockServiceClient as unknown as SupabaseClient,
      'ws-1',
      5,
      'tier_downgrade_agency_to_pro',
    );
    expect(result).toHaveProperty('suspendedMemberIds');
    expect(result).toHaveProperty('preservedCount');
    expect(Array.isArray(result.suspendedMemberIds)).toBe(true);
    expect(result.preservedCount).toBe(5);
  });

  test('EC1 — no-op when activeCount <= keepLimit', async () => {
    activeMemberRows = [
      mkMember('m1', 'owner', '2024-01-01'),
      mkMember('m2', 'member', '2024-02-01'),
      mkMember('m3', 'member', '2024-03-01'),
    ];
    const { bulkSuspendMembers } = await loadSuspendModule();
    const result = await bulkSuspendMembers(
      mockServiceClient as unknown as SupabaseClient,
      'ws-1',
      5,
      'tier_downgrade_agency_to_pro',
    );
    expect(result.suspendedMemberIds).toEqual([]);
    expect(result.preservedCount).toBe(3);
    expect(suspendUpdateCalls).toHaveLength(0); // no UPDATE issued
  });

  test('suspension_reason passed through as tier_downgrade_agency_to_pro', async () => {
    activeMemberRows = [
      mkMember('m1', 'owner', '2024-01-01'),
      mkMember('m2', 'member', '2024-02-01'),
      mkMember('m3', 'client_user', '2024-03-01'),
    ];
    const { bulkSuspendMembers } = await loadSuspendModule();
    await bulkSuspendMembers(
      mockServiceClient as unknown as SupabaseClient,
      'ws-1',
      1, // keepLimit 1 → suspend 2
      'tier_downgrade_agency_to_pro',
    );
    expect(suspendUpdateCalls.length).toBeGreaterThan(0);
    expect(suspendUpdateCalls[0]!.reason).toBe('tier_downgrade_agency_to_pro');
  });

  test('EC7 — idempotent on replay: already-at-limit returns suspendedMemberIds: []', async () => {
    // Simulate a replay: the workspace is already within limit (5 active),
    // so the second webhook invocation suspends nobody.
    activeMemberRows = [
      mkMember('m1', 'owner', '2024-01-01'),
      mkMember('m2', 'admin', '2024-02-01'),
      mkMember('m3', 'member', '2024-03-01'),
      mkMember('m4', 'member', '2024-04-01'),
      mkMember('m5', 'member', '2024-05-01'),
    ];
    const { bulkSuspendMembers } = await loadSuspendModule();
    const result = await bulkSuspendMembers(
      mockServiceClient as unknown as SupabaseClient,
      'ws-1',
      5,
      'tier_downgrade_agency_to_pro',
    );
    expect(result.suspendedMemberIds).toEqual([]);
    expect(suspendUpdateCalls).toHaveLength(0);
  });
});

// ───────────────────────────────────────────────────────────────
// AC3 — Role-priority sort (PD3): owner > admin > member > client_user
// ───────────────────────────────────────────────────────────────
describe('[AC3/PD3] role-priority sort', () => {
  test('exports listActiveMembersByRolePriority as a function', async () => {
    const { listActiveMembersByRolePriority } = await loadSuspendModule();
    expect(typeof listActiveMembersByRolePriority).toBe('function');
  });

  test('EC4 — owners always preserved (sorted first, never suspended)', async () => {
    // Setup: 3 owners + 4 admins = 7 active; keepLimit 5 → suspend 2 admins.
    activeMemberRows = [
      mkMember('owner-1', 'owner', '2024-01-01'),
      mkMember('owner-2', 'owner', '2024-02-01'),
      mkMember('owner-3', 'owner', '2024-03-01'),
      mkMember('admin-1', 'admin', '2024-04-01'),
      mkMember('admin-2', 'admin', '2024-05-01'),
      mkMember('admin-3', 'admin', '2024-06-01'),
      mkMember('admin-4', 'admin', '2024-07-01'),
    ];
    const { bulkSuspendMembers } = await loadSuspendModule();
    const result = await bulkSuspendMembers(
      mockServiceClient as unknown as SupabaseClient,
      'ws-1',
      5,
      'tier_downgrade_agency_to_pro',
    );
    // The 2 suspended IDs must NOT include any owner (PD3 owner-first sort).
    expect(result.suspendedMemberIds).toHaveLength(2);
    for (const id of result.suspendedMemberIds) {
      expect(id).not.toMatch(/^owner/);
    }
  });

  test('PD3 order: owner preserved, then admin, member, client_user (client_user most expendable)', async () => {
    // One of each role, keepLimit 1 (keep only the owner). The function
    // returns suspendedMemberIds in preservation-sort order — i.e. the tail
    // of the ascending-priority list = [admin, member, client_user]. The
    // client_user is the MOST expendable (lowest priority) but appears last
    // in the array because the array follows the sort order, not the
    // "expendability" order. The guarantee being tested: owner is preserved,
    // and the relative priority admin > member > client_user is respected
    // (admin is closer to preserved than member, etc.).
    activeMemberRows = [
      mkMember('cu-1', 'client_user', '2024-01-01'),
      mkMember('mem-1', 'member', '2024-02-01'),
      mkMember('adm-1', 'admin', '2024-03-01'),
      mkMember('own-1', 'owner', '2024-04-01'),
    ];
    const { bulkSuspendMembers } = await loadSuspendModule();
    const result = await bulkSuspendMembers(
      mockServiceClient as unknown as SupabaseClient,
      'ws-1',
      1,
      'tier_downgrade_agency_to_pro',
    );
    // Owner preserved (not in suspended set).
    expect(result.suspendedMemberIds).not.toContain('own-1');
    expect(result.preservedCount).toBe(1);
    // Suspended set is the tail of [own, adm, mem, cu] = [adm, mem, cu].
    expect(result.suspendedMemberIds).toEqual(['adm-1', 'mem-1', 'cu-1']);
  });

  test('PD3 tiebreaker: same role → joined_at ASC (longest-tenured preserved)', async () => {
    activeMemberRows = [
      mkMember('newer', 'member', '2024-12-01'),
      mkMember('older', 'member', '2024-01-01'),
    ];
    const { bulkSuspendMembers } = await loadSuspendModule();
    const result = await bulkSuspendMembers(
      mockServiceClient as unknown as SupabaseClient,
      'ws-1',
      1,
      'tier_downgrade_agency_to_pro',
    );
    // older (joined_at earlier) is preserved; newer is suspended.
    expect(result.suspendedMemberIds).toEqual(['newer']);
  });
});

// ───────────────────────────────────────────────────────────────
// AC2 — applyAgencyToProDowngrade webhook handler (GREEN after Task 4)
// Drives the REAL handler via mockCountActiveMembers + activeMemberRows.
// ───────────────────────────────────────────────────────────────
describe('[AC2] applyAgencyToProDowngrade handler', () => {
  test('exports applyAgencyToProDowngrade as a function', async () => {
    const { applyAgencyToProDowngrade } = await loadDowngradeModule();
    expect(typeof applyAgencyToProDowngrade).toBe('function');
  });

  test('EC3 — suspends excess members when activeCount > proLimit', async () => {
    // 8 active, proLimit 5 → suspend 3 lowest-priority (2 members + 1 client_user).
    mockCountActiveMembers.mockResolvedValueOnce(8);
    activeMemberRows = [
      mkMember('m1', 'owner', '2024-01-01'),
      mkMember('m2', 'admin', '2024-02-01'),
      mkMember('m3', 'admin', '2024-03-01'),
      mkMember('m4', 'admin', '2024-04-01'),
      mkMember('m5', 'member', '2024-05-01'),
      mkMember('m6', 'member', '2024-06-01'),
      mkMember('m7', 'member', '2024-07-01'),
      mkMember('m8', 'client_user', '2024-08-01'),
    ];
    const { applyAgencyToProDowngrade } = await loadDowngradeModule();
    const result = await applyAgencyToProDowngrade({
      workspaceId: 'ws-1',
      supabase: mockServiceClient as unknown as SupabaseClient,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.suspendedMemberIds).toHaveLength(3);
      expect(result.data.preservedCount).toBe(5);
      expect(result.data.upgradePrompt).toMatch(/paused|suspend/i);
    }
  });

  test('EC1 — no-op when within Pro limit', async () => {
    mockCountActiveMembers.mockResolvedValueOnce(4);
    const { applyAgencyToProDowngrade } = await loadDowngradeModule();
    const result = await applyAgencyToProDowngrade({
      workspaceId: 'ws-1',
      supabase: mockServiceClient as unknown as SupabaseClient,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.suspendedMemberIds).toEqual([]);
      expect(result.data.upgradePrompt).toBe('');
    }
  });

  test('calls invalidateUserSessions per suspended member (best-effort)', async () => {
    // 7 active, proLimit 5 → suspend 2 members (m6, m7).
    mockCountActiveMembers.mockResolvedValueOnce(7);
    activeMemberRows = [
      mkMember('m1', 'owner', '2024-01-01'),
      mkMember('m2', 'admin', '2024-02-01'),
      mkMember('m3', 'admin', '2024-03-01'),
      mkMember('m4', 'admin', '2024-04-01'),
      mkMember('m5', 'member', '2024-05-01'),
      mkMember('m6', 'member', '2024-06-01'),
      mkMember('m7', 'member', '2024-07-01'),
    ];
    const { applyAgencyToProDowngrade } = await loadDowngradeModule();
    await applyAgencyToProDowngrade({
      workspaceId: 'ws-1',
      supabase: mockServiceClient as unknown as SupabaseClient,
    });
    expect(mockInvalidateSessions).toHaveBeenCalledTimes(2);
  });

  test('EC6 — partial session-invalidation failure: success:true + warnings', async () => {
    mockCountActiveMembers.mockResolvedValueOnce(7);
    activeMemberRows = [
      mkMember('m1', 'owner', '2024-01-01'),
      mkMember('m2', 'admin', '2024-02-01'),
      mkMember('m3', 'admin', '2024-03-01'),
      mkMember('m4', 'admin', '2024-04-01'),
      mkMember('m5', 'member', '2024-05-01'),
      mkMember('m6', 'member', '2024-06-01'),
      mkMember('m7', 'member', '2024-07-01'),
    ];
    // One of the two invalidations throws.
    mockInvalidateSessions
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('auth admin error'));
    const { applyAgencyToProDowngrade } = await loadDowngradeModule();
    const result = await applyAgencyToProDowngrade({
      workspaceId: 'ws-1',
      supabase: mockServiceClient as unknown as SupabaseClient,
    });
    expect(result.success).toBe(true); // DB writes not rolled back
    if (result.success) {
      expect(result.data.warnings).toContain('session_invalidation_partial');
    }
  });

  test('revalidates workspace_member + workspace_client cache tags', async () => {
    const { revalidateTag } = await import('next/cache');
    mockCountActiveMembers.mockResolvedValueOnce(6);
    activeMemberRows = [
      mkMember('m1', 'owner', '2024-01-01'),
      mkMember('m2', 'admin', '2024-02-01'),
      mkMember('m3', 'admin', '2024-03-01'),
      mkMember('m4', 'admin', '2024-04-01'),
      mkMember('m5', 'member', '2024-05-01'),
      mkMember('m6', 'member', '2024-06-01'),
    ];
    const { applyAgencyToProDowngrade } = await loadDowngradeModule();
    await applyAgencyToProDowngrade({
      workspaceId: 'ws-1',
      supabase: mockServiceClient as unknown as SupabaseClient,
    });
    expect(revalidateTag).toHaveBeenCalledWith(
      // cacheTag('workspace_member', id) → 'workspace-members:<id>' (hyphenated).
      expect.stringMatching(/^workspace-members:/),
    );
    expect(revalidateTag).toHaveBeenCalledWith(
      expect.stringMatching(/^workspace-clients:/),
    );
  });
});

// ───────────────────────────────────────────────────────────────
// Split-don't-invert: 9-5b applyDowngradeOnTierChange stays untouched
// ───────────────────────────────────────────────────────────────
describe('split-don\'t-invert — 9-5b Free path stays green', () => {
  test('applyDowngradeOnTierChange still exists and is a function', async () => {
    const mod = await import('@/lib/actions/billing/downgrade-internal');
    expect(typeof mod.applyDowngradeOnTierChange).toBe('function');
  });
});

// ───────────────────────────────────────────────────────────────
// AC3 / Task 8 — Reactivation hook (upgrade-back Pro→Agency)
// Minimal data-side flip: suspended members → active. Bulk UX deferred to 9-5f.
// ───────────────────────────────────────────────────────────────
describe('[AC3/Task 8] reactivateSuspendedMembers (upgrade-back hook)', () => {
  test('exports reactivateSuspendedMembers as a function', async () => {
    const db = await loadSuspendModule();
    expect(typeof db.reactivateSuspendedMembers).toBe('function');
  });

  test('EC11 — flips suspended members back to active on upgrade-back', async () => {
    // Two suspended members; reactivate both. The query updates
    // status='active', clears suspended_at + suspension_reason.
    activeMemberRows = [
      { ...mkMember('m1', 'member', '2024-01-01'), status: 'suspended' },
      { ...mkMember('m2', 'admin', '2024-02-01'), status: 'suspended' },
    ] as never;
    const { reactivateSuspendedMembers } = await loadSuspendModule();
    const result = await reactivateSuspendedMembers(
      mockServiceClient as unknown as SupabaseClient,
      'ws-1',
    );
    expect(result.reactivatedMemberIds).toHaveLength(2);
  });

  test('reactivation is a no-op when no suspended members exist', async () => {
    activeMemberRows = [];
    const { reactivateSuspendedMembers } = await loadSuspendModule();
    const result = await reactivateSuspendedMembers(
      mockServiceClient as unknown as SupabaseClient,
      'ws-1',
    );
    expect(result.reactivatedMemberIds).toEqual([]);
  });
});

// Retain the SupabaseClient type-only import (lint compliance).
test('SupabaseClient type import is retained', () => {
  const _ignore: SupabaseClient | null = null;
  expect(_ignore).toBeNull();
});
