import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createTimeEntry } from '../create';
import { listTimeEntries } from '../list';
import { softDeleteTimeEntry } from '../soft-delete';

describe('createTimeEntry', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('inserts a time entry and returns mapped result', async () => {
    const insertChain = {
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'te1', workspace_id: 'ws1', client_id: 'c1', user_id: 'u1',
          project_id: null, date: '2026-05-09', duration_minutes: 90,
          start_minutes: null, end_minutes: null,
          notes: 'test', deleted_at: null, created_at: '2026-05-09T00:00:00Z', updated_at: '2026-05-09T00:00:00Z',
        },
        error: null,
      }),
    };
    const supabase = {
      from: vi.fn().mockReturnValue({ insert: vi.fn().mockReturnValue(insertChain) }),
    } as unknown as SupabaseClient;

    const result = await createTimeEntry(supabase, {
      workspaceId: 'ws1', clientId: 'c1', projectId: null, userId: 'u1',
      date: '2026-05-09', durationMinutes: 90, notes: 'test',
    });

    expect(result.id).toBe('te1');
    expect(result.durationMinutes).toBe(90);
    expect(result.projectId).toBeNull();
  });

  it('propagates insert errors', async () => {
    const insertChain = {
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'FK violation', code: '23503' },
      }),
    };
    const supabase = {
      from: vi.fn().mockReturnValue({ insert: vi.fn().mockReturnValue(insertChain) }),
    } as unknown as SupabaseClient;

    await expect(createTimeEntry(supabase, {
      workspaceId: 'ws1', clientId: 'bad', projectId: null, userId: 'u1',
      date: '2026-05-09', durationMinutes: 90,
    })).rejects.toEqual({ message: 'FK violation', code: '23503' });
  });
});

describe('listTimeEntries', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns empty result when dateFrom > dateTo', async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({}) }),
    } as unknown as SupabaseClient;

    const result = await listTimeEntries(supabase, {
      workspaceId: 'ws1', userId: 'u1', role: 'owner',
      filters: { dateFrom: '2026-06-01', dateTo: '2026-05-01' },
    });
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('returns empty when member has no client access', async () => {
    const accessChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const supabase = {
      from: vi.fn().mockReturnValue(accessChain),
    } as unknown as SupabaseClient;

    const result = await listTimeEntries(supabase, {
      workspaceId: 'ws1', userId: 'u1', role: 'member', filters: {},
    });

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(supabase.from).toHaveBeenCalledWith('member_client_access');
  });

  it('scopes member query to accessible client_ids via .in()', async () => {
    const teChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
    };
    const accessChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockResolvedValue({ data: [{ client_id: 'c1' }, { client_id: 'c2' }], error: null }),
    };
    const supabase = {
      from: vi.fn((table: string) =>
        table === 'member_client_access' ? accessChain : { select: vi.fn().mockReturnValue(teChain) },
      ),
    } as unknown as SupabaseClient;

    await listTimeEntries(supabase, {
      workspaceId: 'ws1', userId: 'u1', role: 'member', filters: {},
    });

    expect(teChain.in).toHaveBeenCalledWith('client_id', ['c1', 'c2']);
  });

  it('does not query member_client_access for owner role', async () => {
    const teChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
    };
    const supabase = {
      from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue(teChain) }),
    } as unknown as SupabaseClient;

    await listTimeEntries(supabase, {
      workspaceId: 'ws1', userId: 'u1', role: 'owner', filters: {},
    });

    const tables = (supabase.from as ReturnType<typeof vi.fn>).mock.calls.map((call) => call[0] as string);
    expect(tables).not.toContain('member_client_access');
    expect(teChain.in).not.toHaveBeenCalled();
  });
});

describe('createTimeEntry — constraint violations', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('propagates check constraint error for duration_minutes <= 0', async () => {
    const insertChain = {
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'new row violates check constraint', code: '23514' },
      }),
    };
    const supabase = {
      from: vi.fn().mockReturnValue({ insert: vi.fn().mockReturnValue(insertChain) }),
    } as unknown as SupabaseClient;

    await expect(createTimeEntry(supabase, {
      workspaceId: 'ws1', clientId: 'c1', projectId: null, userId: 'u1',
      date: '2026-05-09', durationMinutes: 0,
    })).rejects.toMatchObject({ code: '23514' });
  });

  it('accepts null project_id (optional FK)', async () => {
    const insertChain = {
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: 'te2', workspace_id: 'ws1', client_id: 'c1', user_id: 'u1',
          project_id: null, date: '2026-05-09', duration_minutes: 30,
          start_minutes: null, end_minutes: null,
          notes: null, deleted_at: null, created_at: '2026-05-09T00:00:00Z', updated_at: '2026-05-09T00:00:00Z',
        },
        error: null,
      }),
    };
    const supabase = {
      from: vi.fn().mockReturnValue({ insert: vi.fn().mockReturnValue(insertChain) }),
    } as unknown as SupabaseClient;

    const result = await createTimeEntry(supabase, {
      workspaceId: 'ws1', clientId: 'c1', projectId: null, userId: 'u1',
      date: '2026-05-09', durationMinutes: 30,
    });

    expect(result.projectId).toBeNull();
  });
});

describe('softDeleteTimeEntry', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('applies user_id filter for member role', async () => {
    const queryPromise = Promise.resolve({ error: null });
    const eqChain = {
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      then: queryPromise.then.bind(queryPromise),
    };
    const supabase = {
      from: vi.fn().mockReturnValue({ update: vi.fn().mockReturnValue(eqChain) }),
    } as unknown as SupabaseClient;

    await softDeleteTimeEntry(supabase, {
      id: 'te1', workspaceId: 'ws1', userId: 'u1', role: 'member',
    });

    const eqCalls = eqChain.eq.mock.calls;
    expect(eqCalls).toContainEqual(['id', 'te1']);
    expect(eqCalls).toContainEqual(['workspace_id', 'ws1']);
    expect(eqCalls).toContainEqual(['user_id', 'u1']);
  });

  it('does NOT apply user_id filter for owner role', async () => {
    const queryPromise = Promise.resolve({ error: null });
    const eqChain = {
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      then: queryPromise.then.bind(queryPromise),
    };
    const supabase = {
      from: vi.fn().mockReturnValue({ update: vi.fn().mockReturnValue(eqChain) }),
    } as unknown as SupabaseClient;

    await softDeleteTimeEntry(supabase, {
      id: 'te1', workspaceId: 'ws1', userId: 'u1', role: 'owner',
    });

    const eqCalls = eqChain.eq.mock.calls;
    expect(eqCalls).toContainEqual(['id', 'te1']);
    expect(eqCalls).toContainEqual(['workspace_id', 'ws1']);
    expect(eqCalls).not.toContainEqual(['user_id', 'u1']);
  });

  it('returns true on success', async () => {
    const queryPromise = Promise.resolve({ error: null });
    const eqChain = {
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      then: queryPromise.then.bind(queryPromise),
    };
    const supabase = {
      from: vi.fn().mockReturnValue({ update: vi.fn().mockReturnValue(eqChain) }),
    } as unknown as SupabaseClient;

    const result = await softDeleteTimeEntry(supabase, {
      id: 'te1', workspaceId: 'ws1', userId: 'u1', role: 'member',
    });
    expect(result).toBe(true);
  });
});
