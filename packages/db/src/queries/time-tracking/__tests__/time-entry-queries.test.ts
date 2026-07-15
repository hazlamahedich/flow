import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  updateTimeEntry,
  insertEditHistory,
  getTimeEntryForUpdate,
} from '../time-entry-queries';

function createMockSupabase() {
  const singleChain = {
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  const insertChain = {
    insert: vi.fn().mockReturnValue({ error: null }),
  };
  return {
    from: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue(singleChain),
      select: vi.fn().mockReturnValue(singleChain),
      insert: vi.fn().mockReturnValue(insertChain),
    }),
    _singleChain: singleChain,
  } as unknown as SupabaseClient & { _singleChain: typeof singleChain };
}

describe('updateTimeEntry', () => {
  it('[P0] returns id and updatedAt on success', async () => {
    const supabase = createMockSupabase();
    supabase._singleChain.single.mockResolvedValue({
      data: { id: 'e-1', updated_at: '2026-05-10T12:00:00Z' },
      error: null,
    });

    const result = await updateTimeEntry(supabase, {
      id: 'e-1',
      workspaceId: 'ws-1',
      durationMinutes: 90,
    });

    expect(result.id).toBe('e-1');
    expect(result.updatedAt).toBe('2026-05-10T12:00:00Z');
  });

  it('[P0] throws on database error', async () => {
    const supabase = createMockSupabase();
    supabase._singleChain.single.mockResolvedValue({
      data: null,
      error: { message: 'RLS denied', code: '42501' },
    });

    await expect(
      updateTimeEntry(supabase, {
        id: 'e-1',
        workspaceId: 'ws-1',
        durationMinutes: 90,
      }),
    ).rejects.toEqual(expect.objectContaining({ code: '42501' }));
  });

  it('[P0] throws NOT_FOUND when no row matched', async () => {
    const supabase = createMockSupabase();
    supabase._singleChain.single.mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(
      updateTimeEntry(supabase, {
        id: 'e-1',
        workspaceId: 'ws-1',
        durationMinutes: 90,
      }),
    ).rejects.toThrow('NOT_FOUND');
  });

  it('[P1] only includes provided fields in update', async () => {
    const supabase = createMockSupabase();
    const updatePayloads: Record<string, unknown>[] = [];
    const fromReturn = {
      update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
        updatePayloads.push(payload);
        return supabase._singleChain;
      }),
    };
    (supabase as unknown as { from: ReturnType<typeof vi.fn> }).from = vi
      .fn()
      .mockReturnValue(fromReturn);
    supabase._singleChain.single.mockResolvedValue({
      data: { id: 'e-1', updated_at: '2026-05-10T12:00:00Z' },
      error: null,
    });

    await updateTimeEntry(supabase, {
      id: 'e-1',
      workspaceId: 'ws-1',
      durationMinutes: 90,
    });

    const payload = updatePayloads[0];
    expect(payload).not.toHaveProperty('client_id');
    expect(payload).toHaveProperty('duration_minutes', 90);
  });
});

describe('insertEditHistory', () => {
  it('[P0] inserts without error', async () => {
    const supabase = createMockSupabase();
    await expect(
      insertEditHistory(supabase, {
        timeEntryId: 'e-1',
        previousValues: { durationMinutes: 60 },
        changedBy: 'u-1',
      }),
    ).resolves.toBeUndefined();
  });

  it('[P0] throws on insert error', async () => {
    const supabase = createMockSupabase();
    const insertReturn = { error: { message: 'FK violation' } };
    const fromReturn = {
      insert: vi.fn().mockReturnValue(insertReturn),
    };
    (supabase as unknown as { from: ReturnType<typeof vi.fn> }).from = vi
      .fn()
      .mockReturnValue(fromReturn);

    await expect(
      insertEditHistory(supabase, {
        timeEntryId: 'e-1',
        previousValues: {},
        changedBy: 'u-1',
      }),
    ).rejects.toEqual(expect.objectContaining({ message: 'FK violation' }));
  });
});

describe('getTimeEntryForUpdate', () => {
  it('[P0] returns mapped entry when found', async () => {
    const supabase = createMockSupabase();
    supabase._singleChain.maybeSingle.mockResolvedValue({
      data: {
        id: 'e-1',
        date: '2026-05-10',
        duration_minutes: 60,
        client_id: 'c-1',
        project_id: null,
        notes: null,
        deleted_at: null,
        user_id: 'u-1',
      },
      error: null,
    });

    const result = await getTimeEntryForUpdate(supabase, {
      id: 'e-1',
      workspaceId: 'ws-1',
    });

    expect(result).not.toBeNull();
    expect(result?.id).toBe('e-1');
    expect(result?.durationMinutes).toBe(60);
  });

  it('[P0] returns null when entry not found', async () => {
    const supabase = createMockSupabase();
    supabase._singleChain.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    const result = await getTimeEntryForUpdate(supabase, {
      id: 'e-1',
      workspaceId: 'ws-1',
    });

    expect(result).toBeNull();
  });

  it('[P0] throws on query error', async () => {
    const supabase = createMockSupabase();
    supabase._singleChain.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'connection failed' },
    });

    await expect(
      getTimeEntryForUpdate(supabase, {
        id: 'e-1',
        workspaceId: 'ws-1',
      }),
    ).rejects.toEqual(
      expect.objectContaining({ message: 'connection failed' }),
    );
  });
});
