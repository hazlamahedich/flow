import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('@flow/db', () => ({
  requireTenantContext: vi.fn(),
  createFlowError: (status: number, code: string, message: string, category: string) => ({
    status, code, message, category,
  }),
}));

import { cancelRun } from '../cancel-run';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext } from '@flow/db';

function setupSupabaseMock(selectResult: { data: Record<string, unknown> | null; error: null | { message: string } }, updateResult?: { data: Record<string, unknown> | null; error: null | { message: string } }) {
  const maybeSingleUpdate = vi.fn().mockResolvedValue(
    updateResult ?? { data: selectResult.data ? { id: selectResult.data.id, status: 'cancelled' } : null, error: null },
  );

  const selectChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(selectResult),
  };

  const updateChain = {
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnValue({
      maybeSingle: maybeSingleUpdate,
    }),
  };

  const fallbackSelect = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: updateResult?.data ? { status: 'cancelled' } : { status: 'running' },
      error: null,
    }),
  };

  const fromMock = vi.fn((table: string) => {
    if (table === 'agent_runs') {
      return {
        select: vi.fn().mockImplementation((cols: string) => {
          if (cols === 'id, status, workspace_id') return selectChain;
          return fallbackSelect;
        }),
        update: vi.fn().mockReturnValue(updateChain),
      };
    }
    return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
  });

  vi.mocked(getServerSupabase).mockResolvedValue({
    from: fromMock,
    auth: { getUser: vi.fn() },
  } as unknown as Awaited<ReturnType<typeof getServerSupabase>>);

  vi.mocked(requireTenantContext).mockResolvedValue({
    workspaceId: 'ws-1',
    userId: 'user-1',
    role: 'owner',
  });

  return { selectChain, updateChain, maybeSingleUpdate, fromMock };
}

describe('cancelRun', () => {
  const VALID_UUID = '00000000-0000-0000-0000-000000000001';
  beforeEach(() => { vi.clearAllMocks(); });

  it('cancels a timed_out run', async () => {
    setupSupabaseMock({
      data: { id: VALID_UUID, status: 'timed_out', workspace_id: 'ws-1' },
      error: null,
    });

    const result = await cancelRun({ runId: VALID_UUID });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.newStatus).toBe('cancelled');
    }
  });

  it('returns idempotent success for already-cancelled run', async () => {
    setupSupabaseMock({
      data: { id: VALID_UUID, status: 'cancelled', workspace_id: 'ws-1' },
      error: null,
    });

    const result = await cancelRun({ runId: VALID_UUID });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.alreadyProcessed).toBe(true);
    }
  });

  it('returns conflict for non-timed_out status', async () => {
    setupSupabaseMock({
      data: { id: VALID_UUID, status: 'running', workspace_id: 'ws-1' },
      error: null,
    });

    const result = await cancelRun({ runId: VALID_UUID });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('CONFLICT');
    }
  });

  it('returns not found for missing run', async () => {
    setupSupabaseMock({ data: null, error: { message: 'Not found' } });

    const result = await cancelRun({ runId: VALID_UUID });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });

  it('rejects invalid input', async () => {
    const result = await cancelRun({ runId: 123 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('handles concurrent status change gracefully', async () => {
    setupSupabaseMock(
      { data: { id: VALID_UUID, status: 'timed_out', workspace_id: 'ws-1' }, error: null },
      { data: null, error: null },
    );

    const result = await cancelRun({ runId: VALID_UUID });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('CONFLICT');
    }
  });

  it('handles database update error', async () => {
    setupSupabaseMock(
      { data: { id: VALID_UUID, status: 'timed_out', workspace_id: 'ws-1' }, error: null },
      { data: null, error: { message: 'DB error' } },
    );

    const result = await cancelRun({ runId: VALID_UUID });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INTERNAL_ERROR');
    }
  });

  it('rejects missing runId', async () => {
    const result = await cancelRun({});
    expect(result.success).toBe(false);
  });
});
