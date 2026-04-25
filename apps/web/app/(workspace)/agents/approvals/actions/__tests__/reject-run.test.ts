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

import { rejectRun } from '../reject-run';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext } from '@flow/db';

const VALID_UUID = '00000000-0000-0000-0000-000000000001';

function setupSupabaseMock(selectResult: { data: Record<string, unknown> | null; error: null | { message: string } }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(selectResult),
    maybeSingle: vi.fn().mockResolvedValue({
      data: selectResult.data ? { id: selectResult.data.id, status: 'cancelled' } : null,
      error: null,
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: selectResult.data ? { id: selectResult.data.id, status: 'cancelled' } : null,
              error: null,
            }),
          }),
        }),
      }),
    }),
  };

  vi.mocked(getServerSupabase).mockResolvedValue({
    from: vi.fn().mockReturnValue(chain),
    auth: { getUser: vi.fn() },
  } as unknown as Awaited<ReturnType<typeof getServerSupabase>>);

  vi.mocked(requireTenantContext).mockResolvedValue({
    workspaceId: 'ws-1', userId: 'user-1', role: 'owner',
  });
}

describe('rejectRun', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('rejects a waiting_approval run → cancelled', async () => {
    setupSupabaseMock({
      data: { id: VALID_UUID, status: 'waiting_approval', output: {}, workspace_id: 'ws-1' },
      error: null,
    });

    const result = await rejectRun({ runId: VALID_UUID, reason: 'Not needed' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.newStatus).toBe('cancelled');
    }
  });

  it('rejects with optional reason omitted', async () => {
    setupSupabaseMock({
      data: { id: VALID_UUID, status: 'waiting_approval', output: {}, workspace_id: 'ws-1' },
      error: null,
    });

    const result = await rejectRun({ runId: VALID_UUID });
    expect(result.success).toBe(true);
  });

  it('returns idempotent success for already cancelled', async () => {
    setupSupabaseMock({
      data: { id: VALID_UUID, status: 'cancelled', output: null, workspace_id: 'ws-1' },
      error: null,
    });

    const result = await rejectRun({ runId: VALID_UUID });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.alreadyProcessed).toBe(true);
    }
  });

  it('returns error for wrong status', async () => {
    setupSupabaseMock({
      data: { id: VALID_UUID, status: 'running', output: null, workspace_id: 'ws-1' },
      error: null,
    });

    const result = await rejectRun({ runId: VALID_UUID });
    expect(result.success).toBe(false);
  });

  it('rejects invalid input', async () => {
    const result = await rejectRun({ runId: '' });
    expect(result.success).toBe(false);
  });
});
