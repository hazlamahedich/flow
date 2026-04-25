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

import { updateProposal } from '../update-proposal';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext } from '@flow/db';

const VALID_UUID = '00000000-0000-0000-0000-000000000001';

function setupSupabaseMock(selectResult: { data: Record<string, unknown> | null; error: null | { message: string } }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(selectResult),
    maybeSingle: vi.fn().mockResolvedValue({
      data: selectResult.data ? { id: selectResult.data.id, status: 'waiting_approval' } : null,
      error: null,
    }),
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: selectResult.data ? { id: selectResult.data.id, status: 'waiting_approval' } : null,
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

describe('updateProposal', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('edits title successfully', async () => {
    setupSupabaseMock({
      data: { id: VALID_UUID, status: 'waiting_approval', output: { title: 'Old', confidence: 0.9, riskLevel: 'low' }, workspace_id: 'ws-1' },
      error: null,
    });

    const result = await updateProposal({ runId: VALID_UUID, title: 'New Title' });
    expect(result.success).toBe(true);
  });

  it('rejects update on non-waiting_approval run', async () => {
    setupSupabaseMock({
      data: { id: VALID_UUID, status: 'completed', output: {}, workspace_id: 'ws-1' },
      error: null,
    });

    const result = await updateProposal({ runId: VALID_UUID, title: 'New' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid riskLevel', async () => {
    const result = await updateProposal({ runId: VALID_UUID, riskLevel: 'extreme' });
    expect(result.success).toBe(false);
  });

  it('rejects empty changes (no fields)', async () => {
    const result = await updateProposal({ runId: VALID_UUID });
    expect(result.success).toBe(false);
  });

  it('rejects confidence out of range', async () => {
    const result = await updateProposal({ runId: VALID_UUID, confidence: 1.5 });
    expect(result.success).toBe(false);
  });
});
