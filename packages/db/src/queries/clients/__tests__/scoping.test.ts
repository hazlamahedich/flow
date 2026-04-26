import { describe, it, expect, vi, beforeEach } from 'vitest';

const createChain = () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.is = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.upsert = vi.fn(() => Promise.resolve({ error: null }));
  chain.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
  return chain;
};

const mockClient = {
  from: vi.fn(() => createChain()),
};

import {
  assignMemberToClient,
  revokeMemberAccess,
  getMembersForClient,
  getClientsForMember,
} from '../scoping';

describe('assignMemberToClient', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('calls upsert on member_client_access', async () => {
    const chain = createChain();
    chain.upsert = vi.fn(() => Promise.resolve({ error: null }));
    mockClient.from = vi.fn(() => chain);

    await assignMemberToClient(mockClient as never, {
      workspaceId: 'ws1', userId: 'u1', clientId: 'c1', grantedBy: 'admin1',
    });

    expect(mockClient.from).toHaveBeenCalledWith('member_client_access');
  });

  it('throws on error', async () => {
    const chain = createChain();
    chain.upsert = vi.fn(() => Promise.resolve({ error: { message: 'db error' } }));
    mockClient.from = vi.fn(() => chain);

    await expect(
      assignMemberToClient(mockClient as never, {
        workspaceId: 'ws1', userId: 'u1', clientId: 'c1', grantedBy: 'admin1',
      }),
    ).rejects.toBeDefined();
  });
});

describe('revokeMemberAccess', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('sets revoked_at', async () => {
    const chain = createChain();
    chain.update = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.is = vi.fn(() => Promise.resolve({ error: null }));
    mockClient.from = vi.fn(() => chain);

    await revokeMemberAccess(mockClient as never, {
      workspaceId: 'ws1', userId: 'u1', clientId: 'c1',
    });

    expect(mockClient.from).toHaveBeenCalledWith('member_client_access');
  });
});

describe('getMembersForClient', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns empty array when no members', async () => {
    const chain = createChain();
    chain.order = vi.fn(() => Promise.resolve({ data: [], error: null }));
    mockClient.from = vi.fn(() => chain);

    const result = await getMembersForClient(mockClient as never, {
      clientId: 'c1', workspaceId: 'ws1',
    });
    expect(result).toEqual([]);
  });
});

describe('getClientsForMember', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns empty array when no clients', async () => {
    const chain = createChain();
    chain.is = vi.fn(() => Promise.resolve({ data: [], error: null }));
    mockClient.from = vi.fn(() => chain);

    const result = await getClientsForMember(mockClient as never, {
      userId: 'u1', workspaceId: 'ws1',
    });
    expect(result).toEqual([]);
  });
});
