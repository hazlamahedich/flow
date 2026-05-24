import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createTimeEntry } from '../create';

function createMockSupabase() {
  const insertChain = {
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  return {
    from: vi.fn().mockReturnValue({ insert: vi.fn().mockReturnValue(insertChain) }),
    _insertChain: insertChain,
  } as unknown as SupabaseClient & { _insertChain: typeof insertChain };
}

describe('createTimeEntry', () => {
  it('[P0] inserts and returns mapped time entry', async () => {
    const supabase = createMockSupabase();
    const now = new Date().toISOString();
    supabase._insertChain.single.mockResolvedValue({
      data: {
        id: 'entry-1', workspace_id: 'ws-1', client_id: 'c-1', user_id: 'u-1',
        project_id: null, date: '2026-05-10', duration_minutes: 60,
        notes: null, deleted_at: null, created_at: now, updated_at: now,
      },
      error: null,
    });

    const result = await createTimeEntry(supabase, {
      workspaceId: 'ws-1', clientId: 'c-1', projectId: null,
      userId: 'u-1', date: '2026-05-10', durationMinutes: 60,
    });

    expect(result.id).toBe('entry-1');
    expect(result.workspaceId).toBe('ws-1');
    expect(result.durationMinutes).toBe(60);
  });

  it('[P0] throws on insert error', async () => {
    const supabase = createMockSupabase();
    supabase._insertChain.single.mockResolvedValue({
      data: null, error: { message: 'RLS violation', code: '42501' },
    });

    await expect(createTimeEntry(supabase, {
      workspaceId: 'ws-1', clientId: 'c-1', projectId: null,
      userId: 'u-1', date: '2026-05-10', durationMinutes: 60,
    })).rejects.toEqual(expect.objectContaining({ code: '42501' }));
  });

  it('[P1] maps null notes correctly', async () => {
    const supabase = createMockSupabase();
    const now = new Date().toISOString();
    supabase._insertChain.single.mockResolvedValue({
      data: {
        id: 'e-1', workspace_id: 'ws-1', client_id: 'c-1', user_id: 'u-1',
        project_id: null, date: '2026-05-10', duration_minutes: 30,
        notes: null, deleted_at: null, created_at: now, updated_at: now,
      },
      error: null,
    });

    const result = await createTimeEntry(supabase, {
      workspaceId: 'ws-1', clientId: 'c-1', projectId: null,
      userId: 'u-1', date: '2026-05-10', durationMinutes: 30,
    });

    expect(result.notes).toBeNull();
  });

  it('[P1] passes notes to insert when provided', async () => {
    const supabase = createMockSupabase();
    const now = new Date().toISOString();
    supabase._insertChain.single.mockResolvedValue({
      data: {
        id: 'e-1', workspace_id: 'ws-1', client_id: 'c-1', user_id: 'u-1',
        project_id: null, date: '2026-05-10', duration_minutes: 30,
        notes: 'Meeting notes', deleted_at: null, created_at: now, updated_at: now,
      },
      error: null,
    });

    const result = await createTimeEntry(supabase, {
      workspaceId: 'ws-1', clientId: 'c-1', projectId: null,
      userId: 'u-1', date: '2026-05-10', durationMinutes: 30, notes: 'Meeting notes',
    });

    expect(result.notes).toBe('Meeting notes');
  });
});
