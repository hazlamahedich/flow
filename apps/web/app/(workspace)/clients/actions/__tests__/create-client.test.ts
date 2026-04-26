import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('@flow/db', () => ({
  requireTenantContext: vi.fn(),
  createFlowError: (status: number, code: string, message: string, category: string) => ({ status, code, message, category }),
  cacheTag: vi.fn((entity: string, id: string) => `${entity}:${id}`),
  insertClient: vi.fn(),
  countActiveClients: vi.fn(),
  checkDuplicateEmail: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

import { createWorkspaceClient } from '../create-client';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, insertClient, countActiveClients, checkDuplicateEmail } from '@flow/db';

const mockGetServerSupabase = vi.mocked(getServerSupabase);
const mockRequireTenantContext = vi.mocked(requireTenantContext);
const mockInsertClient = vi.mocked(insertClient);
const mockCountActiveClients = vi.mocked(countActiveClients);
const mockCheckDuplicateEmail = vi.mocked(checkDuplicateEmail);

const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: { value: { free: { maxClients: 5 } } }, error: null })),
      })),
    })),
  })),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSupabase.mockResolvedValue(mockSupabase as never);
  mockRequireTenantContext.mockResolvedValue({ workspaceId: 'ws1', userId: 'u1', role: 'owner' });
  mockCountActiveClients.mockResolvedValue(2);
  mockCheckDuplicateEmail.mockResolvedValue(null);
});

describe('createWorkspaceClient', () => {
  it('creates client with valid input', async () => {
    const mockClient = { id: 'c1', name: 'Test', status: 'active' };
    mockInsertClient.mockResolvedValue(mockClient as never);

    const result = await createWorkspaceClient({ name: 'Test Client' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe('Test');
  });

  it('rejects invalid input', async () => {
    const result = await createWorkspaceClient({ name: '' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects members from creating clients', async () => {
    mockRequireTenantContext.mockResolvedValue({ workspaceId: 'ws1', userId: 'u1', role: 'member' });
    const result = await createWorkspaceClient({ name: 'Test' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('INSUFFICIENT_ROLE');
  });

  it('blocks when tier limit reached', async () => {
    mockCountActiveClients.mockResolvedValue(5);
    const result = await createWorkspaceClient({ name: 'Test' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('CLIENT_LIMIT_REACHED');
  });

  it('blocks duplicate email', async () => {
    mockCheckDuplicateEmail.mockResolvedValue({ id: 'c0', name: 'Existing', status: 'active' } as never);
    const result = await createWorkspaceClient({ name: 'Test', email: 'dup@example.com' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('CLIENT_DUPLICATE_EMAIL');
  });
});
