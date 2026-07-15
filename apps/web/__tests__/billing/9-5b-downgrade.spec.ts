/**
 * Story 9.5b Unit Tests — Webhook-Bound Downgrade (GREEN PHASE — T4.8)
 *
 * Tests the internal `applyDowngradeOnTierChange` function: schema validation,
 * MRU archive logic, no-delete guarantee, return shape, and edge cases.
 *
 * Replaces the T7.1 RED stubs with real-shape assertions on the actual
 * module. Mocks `createServiceClient` + `bulkArchiveClients` + `countActiveClients`
 * + `getTierConfig` at the boundary.
 *
 * FR57 (client half — data preservation)
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

vi.mock('@/lib/supabase-server', () => ({ getServerSupabase: vi.fn() }));
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

// Boundary mocks — service_role client + bulkArchiveClients + countActiveClients.
const { mockServiceClient, mockBulkArchive, mockCountActive, mockGetTierConfig } = vi.hoisted(() => ({
  mockServiceClient: {
    from: vi.fn(),
  },
  mockBulkArchive: vi.fn(),
  mockCountActive: vi.fn(),
  mockGetTierConfig: vi.fn(),
}));

vi.mock('@flow/db/client', () => ({
  createServiceClient: vi.fn(() => mockServiceClient),
}));

vi.mock('@flow/db', async () => {
  const actual = await vi.importActual<typeof import('@flow/db')>('@flow/db');
  return {
    ...actual,
    bulkArchiveClients: mockBulkArchive,
    countActiveClients: mockCountActive,
    cacheTag: actual.cacheTag,
  };
});
vi.mock('@/lib/config/tier-config', () => ({ getTierConfig: mockGetTierConfig }));

beforeEach(() => {
  vi.clearAllMocks();
  mockGetTierConfig.mockResolvedValue({ tierLimits: { free: { maxClients: 2 } } });
  // Workspace status check: subscription_status='active' by default.
  mockServiceClient.from.mockImplementation((table: string) => {
    if (table === 'workspaces') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { subscription_status: 'active' }, error: null }),
      };
    }
    return {};
  });
});

// Helper: import the module-under-test fresh.
async function loadModule() {
  return await import('@/lib/actions/billing/downgrade-internal');
}

// ───────────────────────────────────────────────────────────────
// 1. Schema validation (AC3, EC2/EC3/EC4)
// ───────────────────────────────────────────────────────────────
describe('[T4.8] downgradeSchema validation', () => {
  test('accepts Pro → Free downgrade', async () => {
    mockCountActive.mockResolvedValueOnce(2);
    const { applyDowngradeOnTierChange } = await loadModule();
    const result = await applyDowngradeOnTierChange({ workspaceId: 'ws-1', fromTier: 'pro', toTier: 'free' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toMatchObject({
        preservedCount: expect.any(Number),
        upgradePrompt: expect.any(String),
      });
    }
  });

  test('accepts Agency → Free downgrade', async () => {
    mockCountActive.mockResolvedValueOnce(5);
    mockBulkArchive.mockResolvedValueOnce({ archivedClientIds: ['c3', 'c4', 'c5'], preservedCount: 2 });
    const { applyDowngradeOnTierChange } = await loadModule();
    const result = await applyDowngradeOnTierChange({ workspaceId: 'ws-1', fromTier: 'agency', toTier: 'free' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.archivedClientIds).toHaveLength(3);
    }
  });

  test('rejects same-tier downgrade (EC3) with INVALID_STATE 409', async () => {
    const { applyDowngradeOnTierChange } = await loadModule();
    const result = await applyDowngradeOnTierChange({
      workspaceId: 'ws-1',
      fromTier: 'free' as 'pro',
      toTier: 'free',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.status).toBe(409);
      expect(result.error.code).toBe('INVALID_STATE');
    }
  });

  test('D5: schema prevents Pro→Pro same-tier downgrade at input boundary', async () => {
    const { downgradeSchema } = await loadModule();
    const parsed = downgradeSchema.safeParse({ fromTier: 'pro', toTier: 'pro' });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const toTierErrors = parsed.error.issues.filter((i) => i.path.includes('toTier'));
      expect(toTierErrors.length).toBeGreaterThan(0);
    }
  });

  test('rejects upgrade-direction (EC4) with VALIDATION_ERROR', async () => {
    const { applyDowngradeOnTierChange } = await loadModule();
    const result = await applyDowngradeOnTierChange({
      workspaceId: 'ws-1',
      fromTier: 'free' as 'pro',
      toTier: 'pro' as 'free',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });
});

// ───────────────────────────────────────────────────────────────
// 2. MRU-last archive logic (AC3)
// ───────────────────────────────────────────────────────────────
describe('[T4.8] MRU-last archive logic', () => {
  test('archives excess clients via bulkArchiveClients (MRU-LAST)', async () => {
    mockCountActive.mockResolvedValueOnce(4);
    mockBulkArchive.mockResolvedValueOnce({ archivedClientIds: ['c3', 'c4'], preservedCount: 2 });
    const { applyDowngradeOnTierChange } = await loadModule();
    const result = await applyDowngradeOnTierChange({ workspaceId: 'ws-1', fromTier: 'pro', toTier: 'free' });
    expect(result.success).toBe(true);
    expect(mockBulkArchive).toHaveBeenCalledWith(expect.anything(), 'ws-1', 2);
    if (result.success) {
      expect(result.data.archivedClientIds).toEqual(['c3', 'c4']);
    }
  });

  test('EC11 — Agency→Free with 50 clients archives 48 (Free=2)', async () => {
    mockCountActive.mockResolvedValueOnce(50);
    const archived = Array.from({ length: 48 }, (_, i) => `c${i + 3}`);
    mockBulkArchive.mockResolvedValueOnce({ archivedClientIds: archived, preservedCount: 2 });
    const { applyDowngradeOnTierChange } = await loadModule();
    const result = await applyDowngradeOnTierChange({ workspaceId: 'ws-1', fromTier: 'agency', toTier: 'free' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.archivedClientIds).toHaveLength(48);
      expect(result.data.preservedCount).toBe(2);
    }
  });
});

// ───────────────────────────────────────────────────────────────
// 3. No-delete guarantee (AC3, EC7)
// ───────────────────────────────────────────────────────────────
describe('[T4.8] no-delete guarantee', () => {
  test('downgrade never deletes — only calls bulkArchiveClients (status flip)', async () => {
    mockCountActive.mockResolvedValueOnce(3);
    mockBulkArchive.mockResolvedValueOnce({ archivedClientIds: ['c3'], preservedCount: 2 });
    const { applyDowngradeOnTierChange } = await loadModule();
    const result = await applyDowngradeOnTierChange({ workspaceId: 'ws-1', fromTier: 'pro', toTier: 'free' });
    expect(result.success).toBe(true);
    // The function MUST call bulkArchiveClients (status flip) and never a DELETE.
    expect(mockBulkArchive).toHaveBeenCalledTimes(1);
  });

  test('bulkArchiveClients archive-call shape does not include any delete verb', async () => {
    mockCountActive.mockResolvedValueOnce(5);
    mockBulkArchive.mockResolvedValueOnce({ archivedClientIds: ['c3', 'c4', 'c5'], preservedCount: 2 });
    const { applyDowngradeOnTierChange } = await loadModule();
    await applyDowngradeOnTierChange({ workspaceId: 'ws-1', fromTier: 'agency', toTier: 'free' });
    // Verify the call signature: (supabase, workspaceId, keepLimit). No delete flag.
    const [clientArg, wsArg, limitArg] = mockBulkArchive.mock.calls[0]!;
    expect(clientArg).toBeDefined();
    expect(wsArg).toBe('ws-1');
    expect(typeof limitArg).toBe('number');
  });
});

// ───────────────────────────────────────────────────────────────
// 4. Return shape (AC3)
// ───────────────────────────────────────────────────────────────
describe('[T4.8] return shape — { preservedCount, archivedClientIds, upgradePrompt }', () => {
  test('returns exact shape on archive', async () => {
    mockCountActive.mockResolvedValueOnce(4);
    mockBulkArchive.mockResolvedValueOnce({ archivedClientIds: ['c3', 'c4'], preservedCount: 2 });
    const { applyDowngradeOnTierChange } = await loadModule();
    const result = await applyDowngradeOnTierChange({ workspaceId: 'ws-1', fromTier: 'pro', toTier: 'free' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        preservedCount: 2,
        archivedClientIds: ['c3', 'c4'],
        upgradePrompt: expect.stringContaining('archived clients'),
      });
    }
  });

  test('returns empty archivedClientIds + empty upgradePrompt when within limit', async () => {
    mockCountActive.mockResolvedValueOnce(2);
    const { applyDowngradeOnTierChange } = await loadModule();
    const result = await applyDowngradeOnTierChange({ workspaceId: 'ws-1', fromTier: 'pro', toTier: 'free' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.archivedClientIds).toEqual([]);
      expect(result.data.upgradePrompt).toBe('');
      expect(result.data.preservedCount).toBe(2);
    }
    expect(mockBulkArchive).not.toHaveBeenCalled();
  });
});

// ───────────────────────────────────────────────────────────────
// 5. EC12 — suspended workspace cannot downgrade
// ───────────────────────────────────────────────────────────────
describe('[T4.8] EC12 — suspended workspace downgrade', () => {
  test('rejects downgrade while subscription_status=suspended with INVALID_STATE (EC12)', async () => {
    mockServiceClient.from.mockImplementationOnce(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { subscription_status: 'suspended' }, error: null }),
    }));
    const { applyDowngradeOnTierChange } = await loadModule();
    const result = await applyDowngradeOnTierChange({ workspaceId: 'ws-1', fromTier: 'pro', toTier: 'free' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_STATE');
      expect(result.error.status).toBe(409);
    }
    expect(mockBulkArchive).not.toHaveBeenCalled();
  });

  test('allows downgrade while subscription_status=past_due (D2)', async () => {
    mockServiceClient.from.mockImplementationOnce(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { subscription_status: 'past_due' }, error: null }),
    }));
    mockCountActive.mockResolvedValueOnce(4);
    mockBulkArchive.mockResolvedValueOnce({ archivedClientIds: ['c3', 'c4'], preservedCount: 2 });
    const { applyDowngradeOnTierChange } = await loadModule();
    const result = await applyDowngradeOnTierChange({ workspaceId: 'ws-1', fromTier: 'pro', toTier: 'free' });
    expect(result.success).toBe(true);
    expect(mockBulkArchive).toHaveBeenCalled();
  });

  test('allows downgrade while subscription_status=cancelled (D2)', async () => {
    mockServiceClient.from.mockImplementationOnce(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { subscription_status: 'cancelled' }, error: null }),
    }));
    mockCountActive.mockResolvedValueOnce(4);
    mockBulkArchive.mockResolvedValueOnce({ archivedClientIds: ['c3', 'c4'], preservedCount: 2 });
    const { applyDowngradeOnTierChange } = await loadModule();
    const result = await applyDowngradeOnTierChange({ workspaceId: 'ws-1', fromTier: 'pro', toTier: 'free' });
    expect(result.success).toBe(true);
    expect(mockBulkArchive).toHaveBeenCalled();
  });

  test('rejects downgrade while subscription_status=deleted with INVALID_STATE (EC12b)', async () => {
    mockServiceClient.from.mockImplementationOnce(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { subscription_status: 'deleted' }, error: null }),
    }));
    const { applyDowngradeOnTierChange } = await loadModule();
    const result = await applyDowngradeOnTierChange({ workspaceId: 'ws-1', fromTier: 'pro', toTier: 'free' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_STATE');
    }
    expect(mockBulkArchive).not.toHaveBeenCalled();
  });

  test('rejects downgrade when workspace row missing (404 WORKSPACE_NOT_FOUND)', async () => {
    mockServiceClient.from.mockImplementationOnce(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }));
    const { applyDowngradeOnTierChange } = await loadModule();
    const result = await applyDowngradeOnTierChange({ workspaceId: 'ws-missing', fromTier: 'pro', toTier: 'free' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('WORKSPACE_NOT_FOUND');
    }
  });
});

// Retain the SupabaseClient type-only import (lint compliance).
test('SupabaseClient type import is retained', () => {
  const _ignore: SupabaseClient | null = null;
  expect(_ignore).toBeNull();
});
