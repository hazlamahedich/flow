import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getTimerState, startTimer, stopTimerRpc } from '../timer';

vi.mock('../timer', async () => {
  const actual = await vi.importActual('../timer');
  return actual;
});

function createMockSupabase() {
  const selectChain = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  const insertChain = {
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue(selectChain),
      insert: vi.fn().mockReturnValue(insertChain),
    }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    _selectChain: selectChain,
    _insertChain: insertChain,
  } as unknown as SupabaseClient & { _selectChain: typeof selectChain; _insertChain: typeof insertChain };
}

describe('getTimerState', () => {
  it('returns null when no row exists', async () => {
    const supabase = createMockSupabase();
    supabase._selectChain.maybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await getTimerState(supabase, {
      workspaceId: 'ws-1',
      userId: 'user-1',
    });

    expect(result).toBeNull();
  });

  it('returns mapped timer state with names', async () => {
    const supabase = createMockSupabase();
    const now = new Date().toISOString();
    supabase._selectChain.maybeSingle.mockResolvedValue({
      data: {
        id: 'timer-1',
        workspace_id: 'ws-1',
        user_id: 'user-1',
        client_id: 'client-1',
        project_id: 'proj-1',
        notes: null,
        started_at: now,
        updated_at: now,
        clients: { name: 'Acme' },
        projects: { name: 'Website' },
      },
      error: null,
    });

    const result = await getTimerState(supabase, {
      workspaceId: 'ws-1',
      userId: 'user-1',
    });

    expect(result).not.toBeNull();
    expect(result?.id).toBe('timer-1');
    expect(result?.clientName).toBe('Acme');
    expect(result?.projectName).toBe('Website');
  });
});

describe('startTimer', () => {
  it('succeeds and returns the created row', async () => {
    const supabase = createMockSupabase();
    const now = new Date().toISOString();
    supabase._insertChain.single.mockResolvedValue({
      data: {
        id: 'timer-1',
        workspace_id: 'ws-1',
        user_id: 'user-1',
        client_id: 'client-1',
        project_id: null,
        notes: null,
        started_at: now,
        updated_at: now,
        clients: { name: 'Acme' },
        projects: null,
      },
      error: null,
    });

    const result = await startTimer(supabase, {
      workspaceId: 'ws-1',
      userId: 'user-1',
      clientId: 'client-1',
      projectId: null,
    });

    expect(result.id).toBe('timer-1');
    expect(result.clientName).toBe('Acme');
  });

  it('throws on unique constraint violation (23505)', async () => {
    const supabase = createMockSupabase();
    supabase._insertChain.single.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'unique constraint violation' },
    });

    await expect(
      startTimer(supabase, {
        workspaceId: 'ws-1',
        userId: 'user-1',
        clientId: 'client-1',
        projectId: null,
      }),
    ).rejects.toEqual(expect.objectContaining({ code: '23505' }));
  });
});

describe('stopTimerRpc', () => {
  it('returns timeEntryId and durationMinutes on success', async () => {
    const supabase = createMockSupabase();
    (supabase as unknown as { rpc: Mock }).rpc.mockResolvedValue({
      data: { timeEntryId: 'entry-1', durationMinutes: 5 },
      error: null,
    });

    const result = await stopTimerRpc(supabase, {
      timerId: 'timer-1',
      workspaceId: 'ws-1',
      userId: 'user-1',
    });

    expect(result.timeEntryId).toBe('entry-1');
    expect(result.durationMinutes).toBe(5);
  });

  it('throws TIMER_NOT_FOUND when RPC returns error field', async () => {
    const supabase = createMockSupabase();
    (supabase as unknown as { rpc: Mock }).rpc.mockResolvedValue({
      data: { error: 'TIMER_NOT_FOUND' },
      error: null,
    });

    await expect(
      stopTimerRpc(supabase, {
        timerId: 'timer-1',
        workspaceId: 'ws-1',
        userId: 'user-1',
      }),
    ).rejects.toThrow('TIMER_NOT_FOUND');
  });
});
