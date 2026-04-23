import { describe, it, expect, vi } from 'vitest';
import { getActiveMembership, getAccessibleClients } from './members';

function mockClient(queryOverrides: Record<string, unknown> = {}) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
  };

  const fromResult = {
    ...chain,
    ...queryOverrides,
  };

  return {
    from: vi.fn().mockReturnValue(fromResult),
  } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

describe('getActiveMembership', () => {
  it('[P0] returns null when no membership found', async () => {
    const client = mockClient({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) });
    const result = await getActiveMembership(client, 'ws-1', 'user-1');
    expect(result).toBeNull();
  });

  it('[P0] returns membership for active non-expired member', async () => {
    const client = mockClient({
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 'mem-1',
          workspace_id: 'ws-1',
          user_id: 'user-1',
          role: 'admin',
          status: 'active',
          expires_at: null,
        },
      }),
    });

    const result = await getActiveMembership(client, 'ws-1', 'user-1');
    expect(result).toEqual({
      id: 'mem-1',
      workspaceId: 'ws-1',
      userId: 'user-1',
      role: 'admin',
      status: 'active',
      expiresAt: null,
    });
  });

  it('[P0] returns null when membership is expired', async () => {
    const client = mockClient({
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 'mem-1',
          workspace_id: 'ws-1',
          user_id: 'user-1',
          role: 'member',
          status: 'active',
          expires_at: new Date(Date.now() - 86400000).toISOString(),
        },
      }),
    });

    const result = await getActiveMembership(client, 'ws-1', 'user-1');
    expect(result).toBeNull();
  });
});

describe('getAccessibleClients', () => {
  it('[P0] owner sees all clients in workspace', async () => {
    const selectChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [
          { id: 'c-1', name: 'Client A' },
          { id: 'c-2', name: 'Client B' },
        ],
      }),
    };
    const client = {
      from: vi.fn().mockReturnValue(selectChain),
    } as unknown as import('@supabase/supabase-js').SupabaseClient;

    const result = await getAccessibleClients(client, 'ws-1', 'user-1', 'owner');
    expect(result).toHaveLength(2);
  });

  it('[P0] member with no access returns empty array', async () => {
    const accessChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockResolvedValue({ data: null }),
    };
    const client = {
      from: vi.fn().mockReturnValue(accessChain),
    } as unknown as import('@supabase/supabase-js').SupabaseClient;

    const result = await getAccessibleClients(client, 'ws-1', 'user-1', 'member');
    expect(result).toEqual([]);
  });

  it('[P0] member sees only clients with granted access', async () => {
    let callCount = 0;
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve({ data: [{ client_id: 'c-1' }] });
          }
          return Promise.resolve({ data: [{ id: 'c-1', name: 'Client A' }] });
        }),
        in: vi.fn().mockResolvedValue({ data: [{ id: 'c-1', name: 'Client A' }] }),
      }),
    } as unknown as import('@supabase/supabase-js').SupabaseClient;

    const result = await getAccessibleClients(client, 'ws-1', 'user-1', 'member');
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('Client A');
  });
});
