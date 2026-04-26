import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('@flow/db', () => ({
  requireTenantContext: vi.fn(),
  createFlowError: (status: number, code: string, message: string, category: string) => ({ status, code, message, category }),
  cacheTag: vi.fn((entity: string, id: string) => `${entity}:${id}`),
  archiveClient: vi.fn(),
  restoreClient: vi.fn(),
  hasActiveAgentRuns: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

import { archiveWorkspaceClient } from '../archive-client';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, archiveClient, hasActiveAgentRuns } from '@flow/db';

const mockGetServerSupabase = vi.mocked(getServerSupabase);
const mockRequireTenantContext = vi.mocked(requireTenantContext);
const mockArchiveClient = vi.mocked(archiveClient);
const mockHasActiveAgentRuns = vi.mocked(hasActiveAgentRuns);

const mockSupabase = {};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSupabase.mockResolvedValue(mockSupabase as never);
  mockRequireTenantContext.mockResolvedValue({ workspaceId: 'ws1', userId: 'u1', role: 'owner' });
});

describe('archiveWorkspaceClient', () => {
  it('archives successfully', async () => {
    mockHasActiveAgentRuns.mockResolvedValue(false);
    mockArchiveClient.mockResolvedValue({ id: 'c1', status: 'archived' } as never);

    const result = await archiveWorkspaceClient({ clientId: '550e8400-e29b-41d4-a716-446655440000' });
    expect(result.success).toBe(true);
  });

  it('blocks when active agent runs exist', async () => {
    mockHasActiveAgentRuns.mockResolvedValue(true);
    const result = await archiveWorkspaceClient({ clientId: '550e8400-e29b-41d4-a716-446655440000' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('CLIENT_ACTIVE_RUNS');
  });

  it('rejects members', async () => {
    mockRequireTenantContext.mockResolvedValue({ workspaceId: 'ws1', userId: 'u1', role: 'member' });
    const result = await archiveWorkspaceClient({ clientId: '550e8400-e29b-41d4-a716-446655440000' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('INSUFFICIENT_ROLE');
  });

  it('rejects invalid clientId', async () => {
    const result = await archiveWorkspaceClient({ clientId: 'not-a-uuid' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('VALIDATION_ERROR');
  });
});
