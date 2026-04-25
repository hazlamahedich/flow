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

import { approveRun } from '../approve-run';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext } from '@flow/db';

function setupSupabaseMock(selectResult: { data: Record<string, unknown> | null; error: null | { message: string } }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(selectResult),
    maybeSingle: vi.fn().mockResolvedValue({
      data: selectResult.data ? { id: selectResult.data.id, status: 'completed' } : null,
      error: null,
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: selectResult.data ? { id: selectResult.data.id, status: 'completed' } : null,
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
    workspaceId: 'ws-1',
    userId: 'user-1',
    role: 'owner',
  });

  return chain;
}

describe('approveRun', () => {
  const VALID_UUID = '00000000-0000-0000-0000-000000000001';
  beforeEach(() => { vi.clearAllMocks(); });

  it('approves an agent proposal → completed', async () => {
    setupSupabaseMock({
      data: {
        id: VALID_UUID,
        status: 'waiting_approval',
        output: { title: 'Test', confidence: 0.9, riskLevel: 'low', reasoning: 'Reason' },
        workspace_id: 'ws-1',
      },
      error: null,
    });

    const result = await approveRun({ runId: VALID_UUID });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.newStatus).toBe('completed');
    }
  });

  it('approves a trust-gated block → running', async () => {
    setupSupabaseMock({
      data: {
        id: VALID_UUID,
        status: 'waiting_approval',
        output: { decision: 'blocked', reason: 'Trust too low' },
        workspace_id: 'ws-1',
      },
      error: null,
    });

    const result = await approveRun({ runId: VALID_UUID });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.newStatus).toBe('running');
    }
  });

  it('returns idempotent success for already-completed run', async () => {
    setupSupabaseMock({
      data: { id: VALID_UUID, status: 'completed', output: null, workspace_id: 'ws-1' },
      error: null,
    });

    const result = await approveRun({ runId: VALID_UUID });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.alreadyProcessed).toBe(true);
    }
  });

  it('returns error for run not found', async () => {
    setupSupabaseMock({ data: null, error: { message: 'Not found' } });

    const result = await approveRun({ runId: VALID_UUID });
    expect(result.success).toBe(false);
  });

  it('rejects invalid input', async () => {
    const result = await approveRun({ runId: 123 });
    expect(result.success).toBe(false);
  });
});
