import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { softDeleteTimeEntry } from '../soft-delete';

function createMockSupabase() {
  const updateChain = {
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockResolvedValue({ error: null }),
  };
  return {
    from: vi
      .fn()
      .mockReturnValue({ update: vi.fn().mockReturnValue(updateChain) }),
    _updateChain: updateChain,
  } as unknown as SupabaseClient & { _updateChain: typeof updateChain };
}

describe('softDeleteTimeEntry', () => {
  it('[P0] sets deleted_at and returns true for owner', async () => {
    const supabase = createMockSupabase();
    const result = await softDeleteTimeEntry(supabase, {
      id: 'e-1',
      workspaceId: 'ws-1',
      userId: 'u-1',
      role: 'owner',
    });
    expect(result).toBe(true);
  });

  it('[P0] adds user_id filter for member role', async () => {
    const supabase = createMockSupabase();
    const eqCalls: Array<[string, string]> = [];
    supabase._updateChain.eq.mockImplementation((col: string, val: string) => {
      eqCalls.push([col, val]);
      return supabase._updateChain;
    });
    supabase._updateChain.is.mockImplementation(() => supabase._updateChain);

    await softDeleteTimeEntry(supabase, {
      id: 'e-1',
      workspaceId: 'ws-1',
      userId: 'u-1',
      role: 'member',
    });

    const columns = eqCalls.map((c) => c[0]);
    expect(columns).toContain('user_id');
  });

  it('[P0] does not add user_id filter for owner role', async () => {
    const supabase = createMockSupabase();
    const eqCalls: Array<[string, string]> = [];
    supabase._updateChain.eq.mockImplementation((col: string, val: string) => {
      eqCalls.push([col, val]);
      return supabase._updateChain;
    });
    supabase._updateChain.is.mockImplementation(() => supabase._updateChain);

    await softDeleteTimeEntry(supabase, {
      id: 'e-1',
      workspaceId: 'ws-1',
      userId: 'u-1',
      role: 'owner',
    });

    const columns = eqCalls.map((c) => c[0]);
    expect(columns).not.toContain('user_id');
  });

  it('[P0] throws on update error', async () => {
    const supabase = createMockSupabase();
    supabase._updateChain.is.mockResolvedValue({
      error: { message: 'RLS violation', code: '42501' },
    });

    await expect(
      softDeleteTimeEntry(supabase, {
        id: 'e-1',
        workspaceId: 'ws-1',
        userId: 'u-1',
        role: 'owner',
      }),
    ).rejects.toEqual(expect.objectContaining({ code: '42501' }));
  });

  it('[P1] does not add user_id filter for admin role (treated same as owner)', async () => {
    const supabase = createMockSupabase();
    const eqCalls: Array<[string, string]> = [];
    supabase._updateChain.eq.mockImplementation((col: string, val: string) => {
      eqCalls.push([col, val]);
      return supabase._updateChain;
    });
    supabase._updateChain.is.mockImplementation(() => supabase._updateChain);

    await softDeleteTimeEntry(supabase, {
      id: 'e-1',
      workspaceId: 'ws-1',
      userId: 'u-1',
      role: 'admin',
    });

    const columns = eqCalls.map((c) => c[0]);
    expect(columns).not.toContain('user_id');
  });
});
