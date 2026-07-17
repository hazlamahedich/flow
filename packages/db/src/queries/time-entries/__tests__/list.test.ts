import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { listTimeEntries } from '../list';

function createMockSupabase(entries: unknown[] = [], total = 0) {
  const rangeChain = {
    order: vi.fn().mockReturnThis(),
    range: vi
      .fn()
      .mockResolvedValue({ data: entries, error: null, count: total }),
  };
  const filterChain = {
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnValue(rangeChain),
  };

  const accessChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockResolvedValue({ data: [], error: null }),
  };

  return {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'member_client_access') return accessChain;
      return { select: vi.fn().mockReturnValue(filterChain) };
    }),
    _filterChain: filterChain,
    _rangeChain: rangeChain,
    _accessChain: accessChain,
  } as unknown as SupabaseClient & {
    _filterChain: typeof filterChain;
    _rangeChain: typeof rangeChain;
    _accessChain: typeof accessChain;
  };
}

describe('listTimeEntries', () => {
  it('[P0] returns empty result for owner with no entries', async () => {
    const supabase = createMockSupabase([], 0);
    const result = await listTimeEntries(supabase, {
      workspaceId: 'ws-1',
      userId: 'u-1',
      role: 'owner',
      filters: {},
    });
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('[P0] returns mapped entries for owner', async () => {
    const now = new Date().toISOString();
    const entries = [
      {
        id: 'e-1',
        workspace_id: 'ws-1',
        client_id: 'c-1',
        user_id: 'u-1',
        project_id: null,
        projects: null,
        date: '2026-05-10',
        duration_minutes: 60,
        start_minutes: null,
        end_minutes: null,
        notes: null,
        deleted_at: null,
        created_at: now,
        updated_at: now,
      },
    ];
    const supabase = createMockSupabase(entries, 1);

    const result = await listTimeEntries(supabase, {
      workspaceId: 'ws-1',
      userId: 'u-1',
      role: 'owner',
      filters: {},
    });

    expect(result.items).toHaveLength(1);
    const first = result.items[0];
    expect(first?.id).toBe('e-1');
    expect(result.total).toBe(1);
  });

  it('[P0] returns empty for member with no client access', async () => {
    const supabase = createMockSupabase();
    supabase._accessChain.is.mockResolvedValue({ data: [], error: null });

    const result = await listTimeEntries(supabase, {
      workspaceId: 'ws-1',
      userId: 'u-1',
      role: 'member',
      filters: {},
    });

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('[P0] returns empty when dateFrom > dateTo', async () => {
    const supabase = createMockSupabase();

    const result = await listTimeEntries(supabase, {
      workspaceId: 'ws-1',
      userId: 'u-1',
      role: 'owner',
      filters: { dateFrom: '2026-06-01', dateTo: '2026-05-01' },
    });

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('[P1] defaults to page 1 and pageSize 25', async () => {
    const supabase = createMockSupabase();

    const result = await listTimeEntries(supabase, {
      workspaceId: 'ws-1',
      userId: 'u-1',
      role: 'owner',
      filters: {},
    });

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(25);
  });

  it('[P1] calculates hasNextPage correctly', async () => {
    const supabase = createMockSupabase([], 30);

    const result = await listTimeEntries(supabase, {
      workspaceId: 'ws-1',
      userId: 'u-1',
      role: 'owner',
      filters: {},
      page: 1,
    });

    expect(result.hasNextPage).toBe(true);
  });

  it('[P1] hasNextPage is false when all entries fit in page', async () => {
    const supabase = createMockSupabase([], 20);

    const result = await listTimeEntries(supabase, {
      workspaceId: 'ws-1',
      userId: 'u-1',
      role: 'owner',
      filters: {},
      page: 1,
    });

    expect(result.hasNextPage).toBe(false);
  });

  it('[P0] throws on query error', async () => {
    const supabase = createMockSupabase();
    supabase._rangeChain.range.mockResolvedValue({
      data: null,
      error: { message: 'db error' },
      count: 0,
    });

    await expect(
      listTimeEntries(supabase, {
        workspaceId: 'ws-1',
        userId: 'u-1',
        role: 'owner',
        filters: {},
      }),
    ).rejects.toEqual(expect.objectContaining({ message: 'db error' }));
  });
});
