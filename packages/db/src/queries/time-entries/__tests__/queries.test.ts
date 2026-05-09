import { describe, it, expect, vi, beforeEach } from 'vitest';

const createChain = () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.is = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.gte = vi.fn(() => chain);
  chain.lte = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.range = vi.fn(() => chain);
  chain.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
  return chain;
};

const mockClient = {
  from: vi.fn(() => createChain()),
};

import { createTimeEntry } from '../create';
import { listTimeEntries } from '../list';
import { softDeleteTimeEntry } from '../soft-delete';

describe('createTimeEntry', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('inserts a time entry and returns mapped result', async () => {
    const chain = createChain();
    chain.single = vi.fn(() => Promise.resolve({
      data: {
        id: 'te1', workspace_id: 'ws1', client_id: 'c1', user_id: 'u1',
        project_id: null, date: '2026-05-09', duration_minutes: 90,
        notes: 'test', deleted_at: null, created_at: '2026-05-09T00:00:00Z', updated_at: '2026-05-09T00:00:00Z',
      },
      error: null,
    }));
    mockClient.from = vi.fn(() => chain);

    const result = await createTimeEntry(mockClient as never, {
      workspaceId: 'ws1', clientId: 'c1', projectId: null, userId: 'u1',
      date: '2026-05-09', durationMinutes: 90, notes: 'test',
    });

    expect(result.id).toBe('te1');
    expect(result.durationMinutes).toBe(90);
    expect(result.projectId).toBeNull();
  });

  it('propagates insert errors', async () => {
    const chain = createChain();
    chain.single = vi.fn(() => Promise.resolve({
      data: null,
      error: { message: 'FK violation', code: '23503' },
    }));
    mockClient.from = vi.fn(() => chain);

    await expect(createTimeEntry(mockClient as never, {
      workspaceId: 'ws1', clientId: 'bad', projectId: null, userId: 'u1',
      date: '2026-05-09', durationMinutes: 90,
    })).rejects.toEqual({ message: 'FK violation', code: '23503' });
  });
});

describe('listTimeEntries', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns empty result when dateFrom > dateTo', async () => {
    const result = await listTimeEntries(mockClient as never, {
      workspaceId: 'ws1', userId: 'u1', role: 'owner',
      filters: { dateFrom: '2026-06-01', dateTo: '2026-05-01' },
    });
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('returns empty when member has no client access', async () => {
    const accessChain = {
      select: vi.fn(function() { return this; }),
      eq: vi.fn(function() { return this; }),
      is: vi.fn(() => Promise.resolve({ data: [], error: null })),
    };
    mockClient.from = vi.fn(() => accessChain as never);

    const result = await listTimeEntries(mockClient as never, {
      workspaceId: 'ws1', userId: 'u1', role: 'member', filters: {},
    });

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(mockClient.from).toHaveBeenCalledWith('member_client_access');
  });

  it('scopes member query to accessible client_ids via .in()', async () => {
    const teChain = {
      select: vi.fn(function() { return this; }),
      eq: vi.fn(function() { return this; }),
      is: vi.fn(function() { return this; }),
      in: vi.fn(function() { return this; }),
      order: vi.fn(function() { return this; }),
      range: vi.fn(() => Promise.resolve({ data: [], error: null, count: 0 })),
    };
    const accessChain = {
      select: vi.fn(function() { return this; }),
      eq: vi.fn(function() { return this; }),
      is: vi.fn(() => Promise.resolve({ data: [{ client_id: 'c1' }, { client_id: 'c2' }], error: null })),
    };

    mockClient.from = vi.fn((table: string) =>
      table === 'member_client_access' ? accessChain as never : teChain as never,
    );

    await listTimeEntries(mockClient as never, {
      workspaceId: 'ws1', userId: 'u1', role: 'member', filters: {},
    });

    expect(teChain.in).toHaveBeenCalledWith('client_id', ['c1', 'c2']);
  });

  it('does not query member_client_access for owner role', async () => {
    const teChain = {
      select: vi.fn(function() { return this; }),
      eq: vi.fn(function() { return this; }),
      is: vi.fn(function() { return this; }),
      in: vi.fn(function() { return this; }),
      order: vi.fn(function() { return this; }),
      range: vi.fn(() => Promise.resolve({ data: [], error: null, count: 0 })),
    };
    mockClient.from = vi.fn(() => teChain as never);

    await listTimeEntries(mockClient as never, {
      workspaceId: 'ws1', userId: 'u1', role: 'owner', filters: {},
    });

    const tables = (mockClient.from.mock.calls as [string][]).map(([t]) => t);
    expect(tables).not.toContain('member_client_access');
    expect(teChain.in).not.toHaveBeenCalled();
  });
});

describe('createTimeEntry — constraint violations', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('propagates check constraint error for duration_minutes <= 0', async () => {
    const chain = createChain();
    chain.single = vi.fn(() => Promise.resolve({
      data: null,
      error: { message: 'new row violates check constraint', code: '23514' },
    }));
    mockClient.from = vi.fn(() => chain);

    await expect(createTimeEntry(mockClient as never, {
      workspaceId: 'ws1', clientId: 'c1', projectId: null, userId: 'u1',
      date: '2026-05-09', durationMinutes: 0,
    })).rejects.toMatchObject({ code: '23514' });
  });

  it('accepts null project_id (optional FK)', async () => {
    const chain = createChain();
    chain.single = vi.fn(() => Promise.resolve({
      data: {
        id: 'te2', workspace_id: 'ws1', client_id: 'c1', user_id: 'u1',
        project_id: null, date: '2026-05-09', duration_minutes: 30,
        notes: null, deleted_at: null, created_at: '2026-05-09T00:00:00Z', updated_at: '2026-05-09T00:00:00Z',
      },
      error: null,
    }));
    mockClient.from = vi.fn(() => chain);

    const result = await createTimeEntry(mockClient as never, {
      workspaceId: 'ws1', clientId: 'c1', projectId: null, userId: 'u1',
      date: '2026-05-09', durationMinutes: 30,
    });

    expect(result.projectId).toBeNull();
  });
});

describe('softDeleteTimeEntry', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  const makeUpdateChain = () => {
    const queryPromise = Promise.resolve({ error: null });
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    chain.eq = vi.fn(() => chain);
    chain.is = vi.fn(() => chain);
    chain.then = queryPromise.then.bind(queryPromise);
    return chain;
  };

  it('applies user_id filter for member role', async () => {
    const updateChain = makeUpdateChain();
    const fromChain = { update: vi.fn(() => updateChain) };
    mockClient.from = vi.fn(() => fromChain);

    await softDeleteTimeEntry(mockClient as never, {
      id: 'te1', workspaceId: 'ws1', userId: 'u1', role: 'member',
    });

    expect(fromChain.update).toHaveBeenCalledWith({ deleted_at: expect.any(String) });
    const eqCalls = updateChain.eq.mock.calls as [string, string][];
    expect(eqCalls).toContainEqual(['id', 'te1']);
    expect(eqCalls).toContainEqual(['workspace_id', 'ws1']);
    expect(eqCalls).toContainEqual(['user_id', 'u1']);
  });

  it('does NOT apply user_id filter for owner role', async () => {
    const updateChain = makeUpdateChain();
    const fromChain = { update: vi.fn(() => updateChain) };
    mockClient.from = vi.fn(() => fromChain);

    await softDeleteTimeEntry(mockClient as never, {
      id: 'te1', workspaceId: 'ws1', userId: 'u1', role: 'owner',
    });

    const eqCalls = updateChain.eq.mock.calls as [string, string][];
    expect(eqCalls).toContainEqual(['id', 'te1']);
    expect(eqCalls).toContainEqual(['workspace_id', 'ws1']);
    expect(eqCalls).not.toContainEqual(['user_id', 'u1']);
  });

  it('returns true on success', async () => {
    const updateChain = makeUpdateChain();
    mockClient.from = vi.fn(() => ({ update: vi.fn(() => updateChain) }));

    const result = await softDeleteTimeEntry(mockClient as never, {
      id: 'te1', workspaceId: 'ws1', userId: 'u1', role: 'member',
    });
    expect(result).toBe(true);
  });
});
