import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('@flow/db', () => ({
  requireTenantContext: vi.fn(),
  createFlowError: (status: number, code: string, message: string, category: string) => ({ status, code, message, category }),
  cacheTag: vi.fn((entity: string, id: string) => `${entity}:${id}`),
  getClientById: vi.fn(),
  updateClient: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

import { updateWorkspaceClient } from '../update-client';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, getClientById, updateClient } from '@flow/db';

const mockGetServerSupabase = vi.mocked(getServerSupabase);
const mockRequireTenantContext = vi.mocked(requireTenantContext);
const mockGetClientById = vi.mocked(getClientById);
const mockUpdateClient = vi.mocked(updateClient);

const UUID = '550e8400-e29b-41d4-a716-446655440000';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSupabase.mockResolvedValue({} as never);
  mockRequireTenantContext.mockResolvedValue({ workspaceId: 'ws1', userId: 'u1', role: 'owner' });
  mockGetClientById.mockResolvedValue({ id: UUID, name: 'Test', status: 'active' } as never);
  mockUpdateClient.mockResolvedValue({ id: UUID, name: 'Updated' } as never);
});

describe('updateWorkspaceClient', () => {
  it('updates client with valid input', async () => {
    const result = await updateWorkspaceClient({ clientId: UUID, name: 'Updated Name' });
    expect(result.success).toBe(true);
    expect(mockUpdateClient).toHaveBeenCalled();
  });

  it('rejects invalid clientId', async () => {
    const result = await updateWorkspaceClient({ clientId: 'bad', name: 'X' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects members from updating clients', async () => {
    mockRequireTenantContext.mockResolvedValue({ workspaceId: 'ws1', userId: 'u1', role: 'member' });
    const result = await updateWorkspaceClient({ clientId: UUID, name: 'X' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('INSUFFICIENT_ROLE');
  });

  it('returns 404 when client not found', async () => {
    mockGetClientById.mockResolvedValue(null as never);
    const result = await updateWorkspaceClient({ clientId: UUID, name: 'X' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('CLIENT_NOT_FOUND');
  });

  it('blocks editing archived client', async () => {
    mockGetClientById.mockResolvedValue({ id: UUID, name: 'Archived', status: 'archived' } as never);
    const result = await updateWorkspaceClient({ clientId: UUID, name: 'X' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('CLIENT_ARCHIVED');
  });

  it('allows updating email to null', async () => {
    const result = await updateWorkspaceClient({ clientId: UUID, email: null });
    expect(result.success).toBe(true);
  });

  it('allows updating hourlyRateCents', async () => {
    const result = await updateWorkspaceClient({ clientId: UUID, hourlyRateCents: 10000 });
    expect(result.success).toBe(true);
  });

  it('handles db error gracefully', async () => {
    mockUpdateClient.mockRejectedValue(new Error('db fail') as never);
    const result = await updateWorkspaceClient({ clientId: UUID, name: 'X' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('INTERNAL_ERROR');
  });
});
