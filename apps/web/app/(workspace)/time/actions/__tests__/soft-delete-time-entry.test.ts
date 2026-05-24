import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('@flow/db', () => ({
  requireTenantContext: vi.fn(),
  createFlowError: (status: number, code: string, message: string, category: string) => ({
    status, code, message, category,
  }),
  softDeleteTimeEntry: vi.fn(),
}));

import { softDeleteTimeEntryAction } from '../soft-delete-time-entry';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, softDeleteTimeEntry } from '@flow/db';

const mockSupabase = { from: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSupabase).mockResolvedValue(mockSupabase as never);
  vi.mocked(requireTenantContext).mockResolvedValue({
    workspaceId: 'ws-1', userId: 'u-1', role: 'owner',
  } as never);
});

describe('softDeleteTimeEntryAction', () => {
  it('[P0] returns validation error for non-UUID id', async () => {
    const result = await softDeleteTimeEntryAction({ id: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('[P0] returns validation error for missing id', async () => {
    const result = await softDeleteTimeEntryAction({});
    expect(result.success).toBe(false);
  });

  it('[P0] returns success on valid soft delete', async () => {
    vi.mocked(softDeleteTimeEntry).mockResolvedValue(true as never);

    const result = await softDeleteTimeEntryAction({ id: '00000000-0000-0000-0000-000000000001' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.success).toBe(true);
  });

  it('[P0] passes correct params including role for RLS scoping', async () => {
    vi.mocked(softDeleteTimeEntry).mockResolvedValue(true as never);

    await softDeleteTimeEntryAction({ id: '00000000-0000-0000-0000-000000000001' });

    expect(softDeleteTimeEntry).toHaveBeenCalledWith(
      mockSupabase,
      expect.objectContaining({
        id: '00000000-0000-0000-0000-000000000001',
        workspaceId: 'ws-1',
        userId: 'u-1',
        role: 'owner',
      }),
    );
  });

  it('[P0] passes member role for member-scoped deletion', async () => {
    vi.mocked(requireTenantContext).mockResolvedValue({
      workspaceId: 'ws-1', userId: 'u-2', role: 'member',
    } as never);
    vi.mocked(softDeleteTimeEntry).mockResolvedValue(true as never);

    await softDeleteTimeEntryAction({ id: '00000000-0000-0000-0000-000000000001' });

    expect(softDeleteTimeEntry).toHaveBeenCalledWith(
      mockSupabase,
      expect.objectContaining({ role: 'member', userId: 'u-2' }),
    );
  });

  it('[P0] returns INTERNAL_ERROR when softDeleteTimeEntry throws', async () => {
    vi.mocked(softDeleteTimeEntry).mockRejectedValue(new Error('db error') as never);

    const result = await softDeleteTimeEntryAction({ id: '00000000-0000-0000-0000-000000000001' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('INTERNAL_ERROR');
  });
});
