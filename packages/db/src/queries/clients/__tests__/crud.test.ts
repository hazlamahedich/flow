import { describe, it, expect, vi, beforeEach } from 'vitest';

const createChain = () => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
  chain.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
  chain.order = vi.fn(() => chain);
  chain.range = vi.fn(() => chain);
  chain.is = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.or = vi.fn(() => chain);
  return chain;
};

const mockClient = {
  from: vi.fn(() => createChain()),
};

import {
  getClientById,
  listClients,
  insertClient,
  archiveClient,
  restoreClient,
  countActiveClients,
} from '../crud';

describe('getClientById', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns null when client not found', async () => {
    const chain = createChain();
    chain.maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));
    mockClient.from = vi.fn(() => chain);
    const result = await getClientById(mockClient as never, { clientId: 'c1', workspaceId: 'ws1' });
    expect(result).toBeNull();
  });

  it('returns mapped client when found', async () => {
    const chain = createChain();
    chain.maybeSingle = vi.fn(() => Promise.resolve({
      data: { id: 'c1', workspace_id: 'ws1', name: 'Test', email: null, phone: null, company_name: null, address: null, notes: null, billing_email: null, hourly_rate_cents: null, status: 'active', archived_at: null, created_at: '2026-01-01', updated_at: '2026-01-01' },
      error: null,
    }));
    mockClient.from = vi.fn(() => chain);
    const result = await getClientById(mockClient as never, { clientId: 'c1', workspaceId: 'ws1' });
    expect(result).not.toBeNull();
    expect(result?.name).toBe('Test');
  });
});

describe('listClients', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns empty result for member with no access', async () => {
    const accessChain = createChain();
    accessChain.is = vi.fn(() => Promise.resolve({ data: [], error: null }));
    mockClient.from = vi.fn((table: string) => {
      if (table === 'member_client_access') return accessChain;
      return createChain();
    });

    const result = await listClients(mockClient as never, {
      workspaceId: 'ws1', userId: 'u1', role: 'member',
      filters: { page: 1, pageSize: 25, sortBy: 'created_at', sortOrder: 'desc' },
    });
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });
});

describe('insertClient', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('inserts and returns mapped client', async () => {
    const chain = createChain();
    chain.single = vi.fn(() => Promise.resolve({
      data: { id: 'c1', workspace_id: 'ws1', name: 'New Client', email: null, phone: null, company_name: null, address: null, notes: null, billing_email: null, hourly_rate_cents: null, status: 'active', archived_at: null, created_at: '2026-01-01', updated_at: '2026-01-01' },
      error: null,
    }));
    mockClient.from = vi.fn(() => chain);

    const result = await insertClient(mockClient as never, {
      workspaceId: 'ws1',
      data: { name: 'New Client' },
    });
    expect(result.name).toBe('New Client');
  });
});

describe('archiveClient', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('sets status to archived and archived_at', async () => {
    const chain = createChain();
    chain.maybeSingle = vi.fn(() => Promise.resolve({
      data: { id: 'c1', workspace_id: 'ws1', name: 'Test', email: null, phone: null, company_name: null, address: null, notes: null, billing_email: null, hourly_rate_cents: null, status: 'archived', archived_at: '2026-01-01', created_at: '2026-01-01', updated_at: '2026-01-01' },
      error: null,
    }));
    mockClient.from = vi.fn(() => chain);

    const result = await archiveClient(mockClient as never, { clientId: 'c1', workspaceId: 'ws1' });
    expect(result!.status).toBe('archived');
    expect(result!.archivedAt).not.toBeNull();
  });
});

describe('restoreClient', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('sets status to active and clears archived_at', async () => {
    const chain = createChain();
    chain.maybeSingle = vi.fn(() => Promise.resolve({
      data: { id: 'c1', workspace_id: 'ws1', name: 'Test', email: null, phone: null, company_name: null, address: null, notes: null, billing_email: null, hourly_rate_cents: null, status: 'active', archived_at: null, created_at: '2026-01-01', updated_at: '2026-01-01' },
      error: null,
    }));
    mockClient.from = vi.fn(() => chain);

    const result = await restoreClient(mockClient as never, { clientId: 'c1', workspaceId: 'ws1' });
    expect(result!.status).toBe('active');
    expect(result!.archivedAt).toBeNull();
  });
});

describe('countActiveClients', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns count', async () => {
    const chain = createChain();
    chain.eq = vi.fn(() => chain);
    mockClient.from = vi.fn(() => chain);
    const result = await countActiveClients(mockClient as never, 'ws1');
    expect(typeof result).toBe('number');
  });
});
