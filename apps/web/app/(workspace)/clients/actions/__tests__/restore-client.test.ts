import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('@flow/db', () => ({
  requireTenantContext: vi.fn(),
  createFlowError: (status: number, code: string, message: string, category: string) => ({ status, code, message, category }),
  cacheTag: vi.fn((entity: string, id: string) => `${entity}:${id}`),
  restoreClient: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

import { restoreWorkspaceClient } from '../restore-client';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, restoreClient } from '@flow/db';

const mockGetServerSupabase = vi.mocked(getServerSupabase);
const mockRequireTenantContext = vi.mocked(requireTenantContext);
const mockRestoreClient = vi.mocked(restoreClient);

const UUID = '550e8400-e29b-41d4-a716-446655440000';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSupabase.mockResolvedValue({} as never);
  mockRequireTenantContext.mockResolvedValue({ workspaceId: 'ws1', userId: 'u1', role: 'owner' });
});

describe('restoreWorkspaceClient', () => {
  it('restores archived client successfully', async () => {
    mockRestoreClient.mockResolvedValue({ id: UUID, status: 'active' } as never);
    const result = await restoreWorkspaceClient({ clientId: UUID });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.status).toBe('active');
  });

  it('rejects invalid clientId', async () => {
    const result = await restoreWorkspaceClient({ clientId: 'not-uuid' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects members from restoring clients', async () => {
    mockRequireTenantContext.mockResolvedValue({ workspaceId: 'ws1', userId: 'u1', role: 'member' });
    const result = await restoreWorkspaceClient({ clientId: UUID });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('INSUFFICIENT_ROLE');
  });

  it('returns 404 when client not found or already active', async () => {
    mockRestoreClient.mockResolvedValue(null as never);
    const result = await restoreWorkspaceClient({ clientId: UUID });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('CLIENT_NOT_FOUND');
  });

  it('handles db error gracefully', async () => {
    mockRestoreClient.mockRejectedValue(new Error('db fail') as never);
    const result = await restoreWorkspaceClient({ clientId: UUID });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('INTERNAL_ERROR');
  });

  it('allows admin to restore', async () => {
    mockRequireTenantContext.mockResolvedValue({ workspaceId: 'ws1', userId: 'u1', role: 'admin' });
    mockRestoreClient.mockResolvedValue({ id: UUID, status: 'active' } as never);
    const result = await restoreWorkspaceClient({ clientId: UUID });
    expect(result.success).toBe(true);
  });
});
