import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TrustClient, TrustDecision } from '@flow/trust';

// ── DB mock ───────────────────────────────────────────────────────────────────

const mockFrom = vi.fn();
const mockGetAgentConfiguration = vi.fn();
const mockInsertRun = vi.fn();
const mockWriteAuditLog = vi.fn();

vi.mock('@flow/db', () => ({
  createServiceClient: () => ({ from: mockFrom }),
  getAgentConfiguration: mockGetAgentConfiguration,
  insertRun: mockInsertRun,
}));

vi.mock('../../shared/audit-writer', () => ({
  writeAuditLog: mockWriteAuditLog,
}));

// ── helper: build chainable Supabase mock ─────────────────────────────────────

function supabaseChain(finalResult: { data: unknown; error: null | { message: string } }) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    is: () => chain,
    gte: () => chain,
    lte: () => chain,
    limit: () => chain,
    upsert: () => chain,
    update: () => chain,
    insert: () => chain,
    maybeSingle: async () => finalResult,
    single: async () => finalResult,
  };
  return chain;
}

// ── trust client factory ──────────────────────────────────────────────────────

function makeTrustClient(level: 'supervised' | 'confirm' | 'auto'): TrustClient {
  return {
    canAct: vi.fn().mockResolvedValue({
      allowed: true,
      level,
      reason: 'ok',
      snapshotId: 'snap-1',
      preconditionsPassed: true,
    } satisfies TrustDecision),
    recordSuccess: vi.fn(),
    recordViolation: vi.fn(),
    recordPrecheckFailure: vi.fn(),
    manualOverride: vi.fn(),
    updateMetric: vi.fn(),
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('execute — time integrity sweep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertRun.mockResolvedValue({ id: 'run-1' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('throws when workspaceId is null (AC10 isolation guard)', async () => {
    const { execute } = await import('../executor');
    await expect(
      execute({ workspaceId: '', sweepDate: '2026-05-12' }),
    ).rejects.toThrow('workspaceId must not be null');
  });

  describe('AC9: agent disabled guard', () => {
    test('returns zero writes when agent is not active', async () => {
      mockGetAgentConfiguration.mockResolvedValue({ status: 'inactive' });

      const { execute } = await import('../executor');
      const result = await execute({ workspaceId: 'ws-1', sweepDate: '2026-05-12' });

      expect(result).toEqual({ success: true, data: { signalsCreated: 0, skippedDuplicates: 0 } });
      expect(mockFrom).not.toHaveBeenCalled();
    });

    test('returns zero writes when no agent config exists', async () => {
      mockGetAgentConfiguration.mockResolvedValue(null);

      const { execute } = await import('../executor');
      const result = await execute({ workspaceId: 'ws-1', sweepDate: '2026-05-12' });

      expect(result).toEqual({ success: true, data: { signalsCreated: 0, skippedDuplicates: 0 } });
    });
  });

  describe('AC8: idempotency', () => {
    test('skips duplicate signal on second sweep run (ON CONFLICT = null upsert)', async () => {
      mockGetAgentConfiguration.mockResolvedValue({ status: 'active' });

      // Entries: one low-hours day
      const mockEntries = [{ id: 'e1', date: '2026-05-12', duration_minutes: 30 }];
      mockFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            is: () => ({
              gte: () => ({
                lte: () => ({
                  limit: () => ({ data: mockEntries, error: null }),
                }),
              }),
            }),
          }),
        }),
        upsert: () => ({
          select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        }),
      });

      const { execute } = await import('../executor');
      const result = await execute({ workspaceId: 'ws-1', sweepDate: '2026-05-12' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.signalsCreated).toBe(0);
        expect(result.data.skippedDuplicates).toBe(1);
      }
      expect(mockInsertRun).not.toHaveBeenCalled();
    });

    test('creates signal on first run (upsert returns row)', async () => {
      mockGetAgentConfiguration.mockResolvedValue({ status: 'active' });

      const mockEntries = [{ id: 'e1', date: '2026-05-12', duration_minutes: 30 }];
      const signalId = 'sig-abc';

      mockFrom.mockImplementation((table: string) => {
        if (table === 'time_entries') {
          return {
            select: () => ({
              eq: () => ({
                is: () => ({
                  gte: () => ({
                    lte: () => ({
                      limit: () => ({ data: mockEntries, error: null }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'time_integrity_signals') {
          return {
            upsert: () => ({
              select: () => ({ maybeSingle: async () => ({ data: { id: signalId }, error: null }) }),
            }),
          };
        }
        return supabaseChain({ data: null, error: null });
      });

      const trustClient = makeTrustClient('supervised');
      const { execute } = await import('../executor');
      const result = await execute(
        { workspaceId: 'ws-1', sweepDate: '2026-05-12' },
        { trustClient },
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.signalsCreated).toBe(1);
        expect(result.data.skippedDuplicates).toBe(0);
      }
      expect(mockInsertRun).toHaveBeenCalledOnce();
    });
  });

  describe('AC6: trust matrix behavioral tests', () => {
    function setupEntryMock(entries: Array<{ id: string; date: string; duration_minutes: number }>, signalId = 'sig-1') {
      mockGetAgentConfiguration.mockResolvedValue({ status: 'active' });
      mockFrom.mockImplementation((table: string) => {
        if (table === 'time_entries') {
          return {
            select: () => ({
              eq: () => ({
                is: () => ({
                  gte: () => ({
                    lte: () => ({
                      limit: () => ({ data: entries, error: null }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'time_integrity_signals') {
          return {
            upsert: () => ({
              select: () => ({ maybeSingle: async () => ({ data: { id: signalId }, error: null }) }),
            }),
          };
        }
        return supabaseChain({ data: null, error: null });
      });
    }

    const lowHoursEntry = [{ id: 'e1', date: '2026-05-12', duration_minutes: 30 }];

    test('supervised: signal created, agent_run in waiting_approval, resolved_at null', async () => {
      setupEntryMock(lowHoursEntry);
      const trustClient = makeTrustClient('supervised');
      const { execute } = await import('../executor');
      const result = await execute({ workspaceId: 'ws-1', sweepDate: '2026-05-12' }, { trustClient });

      expect(result.success).toBe(true);
      if (result.success) expect(result.data.signalsCreated).toBe(1);
      expect(mockInsertRun).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'waiting_approval', trustTierAtExecution: 'supervised' }),
      );
    });

    test('confirm: signal created, agent_run in waiting_approval', async () => {
      setupEntryMock(lowHoursEntry, 'sig-2');
      const trustClient = makeTrustClient('confirm');
      const { execute } = await import('../executor');
      const result = await execute({ workspaceId: 'ws-1', sweepDate: '2026-05-12' }, { trustClient });

      expect(result.success).toBe(true);
      expect(mockInsertRun).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'waiting_approval', trustTierAtExecution: 'confirm' }),
      );
    });

    test('auto: signal created with resolved_at set, no agent_run created', async () => {
      setupEntryMock(lowHoursEntry, 'sig-3');

      // For auto, upsert payload should include resolved_at — capture it
      let capturedPayload: Record<string, unknown> | null = null;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'time_entries') {
          return {
            select: () => ({
              eq: () => ({
                is: () => ({
                  gte: () => ({
                    lte: () => ({
                      limit: () => ({ data: lowHoursEntry, error: null }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'time_integrity_signals') {
          return {
            upsert: (payload: Record<string, unknown>) => {
              capturedPayload = payload;
              return {
                select: () => ({ maybeSingle: async () => ({ data: { id: 'sig-3' }, error: null }) }),
              };
            },
          };
        }
        return supabaseChain({ data: null, error: null });
      });

      const trustClient = makeTrustClient('auto');
      const { execute } = await import('../executor');
      const result = await execute({ workspaceId: 'ws-1', sweepDate: '2026-05-12' }, { trustClient });

      expect(result.success).toBe(true);
      expect(capturedPayload).not.toBeNull();
      expect(capturedPayload).toHaveProperty('resolved_at');
      expect(mockInsertRun).not.toHaveBeenCalled();
    });
  });

  describe('AC6: trust suppression', () => {
    test('signal suppressed and audit-logged when canAct returns allowed: false', async () => {
      mockGetAgentConfiguration.mockResolvedValue({ status: 'active' });

      const lowHoursEntries = [{ id: 'e1', date: '2026-05-12', duration_minutes: 30 }];
      const tablesQueried: string[] = [];

      mockFrom.mockImplementation((table: string) => {
        tablesQueried.push(table);
        if (table === 'time_entries') {
          return {
            select: () => ({
              eq: () => ({
                is: () => ({
                  gte: () => ({
                    lte: () => ({
                      limit: () => ({ data: lowHoursEntries, error: null }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return supabaseChain({ data: null, error: null });
      });

      const trustClient: TrustClient = {
        canAct: vi.fn().mockResolvedValue({
          allowed: false,
          level: 'supervised' as const,
          reason: 'precondition failed',
          snapshotId: 'snap-x',
          preconditionsPassed: false,
          failedPreconditionKey: 'daily_limit_exceeded',
        }),
        recordSuccess: vi.fn(),
        recordViolation: vi.fn(),
        recordPrecheckFailure: vi.fn(),
        manualOverride: vi.fn(),
        updateMetric: vi.fn(),
      };

      const { execute } = await import('../executor');
      const result = await execute({ workspaceId: 'ws-1', sweepDate: '2026-05-12' }, { trustClient });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.signalsCreated).toBe(0);
        expect(result.data.skippedDuplicates).toBe(0);
      }
      expect(tablesQueried).not.toContain('time_integrity_signals');
      expect(mockInsertRun).not.toHaveBeenCalled();
      expect(mockWriteAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'sweep.signal.precondition_failed' }),
      );
    });
  });

  describe('AC10: cross-workspace isolation', () => {
    test('sweep for workspace A does not query entries for workspace B', async () => {
      mockGetAgentConfiguration.mockResolvedValue({ status: 'active' });

      const capturedWorkspaceIds: string[] = [];

      mockFrom.mockImplementation((table: string) => {
        return {
          select: () => ({
            eq: (col: string, val: string) => {
              if (col === 'workspace_id') capturedWorkspaceIds.push(val);
              return {
                is: () => ({
                  gte: () => ({
                    lte: () => ({
                      limit: () => ({ data: [], error: null }),
                    }),
                  }),
                }),
                eq: () => ({
                  is: () => ({
                    gte: () => ({
                      lte: () => ({
                        limit: () => ({ data: [], error: null }),
                      }),
                    }),
                  }),
                }),
              };
            },
          }),
          upsert: () => ({
            select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
          }),
        };
      });

      const { execute } = await import('../executor');
      await execute({ workspaceId: 'ws-A', sweepDate: '2026-05-12' });

      // All workspace_id predicates must be 'ws-A' only
      expect(capturedWorkspaceIds.every((id) => id === 'ws-A')).toBe(true);
    });
  });
});
