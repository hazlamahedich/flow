import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('@flow/db', () => ({
  requireTenantContext: vi.fn(),
  createFlowError: (status: number, code: string, message: string, category: string) => ({ status, code, message, category }),
  cacheTag: vi.fn((entity: string, id: string) => `${entity}:${id}`),
  updateRetainer: vi.fn(),
  getRetainerById: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

import { updateRetainerAction } from '../update-retainer';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, updateRetainer, getRetainerById } from '@flow/db';

const mockGetServerSupabase = vi.mocked(getServerSupabase);
const mockRequireTenantContext = vi.mocked(requireTenantContext);
const mockUpdateRetainer = vi.mocked(updateRetainer);
const mockGetRetainerById = vi.mocked(getRetainerById);

const RETAINER_ID = '00000000-0000-0000-0000-000000000002';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSupabase.mockResolvedValue({} as never);
  mockRequireTenantContext.mockResolvedValue({ workspaceId: 'ws1', userId: 'u1', role: 'owner' });
});

describe('updateRetainerAction', () => {
  it('updates active retainer', async () => {
    mockGetRetainerById.mockResolvedValue({ id: RETAINER_ID, status: 'active', type: 'hourly_rate' } as never);
    mockUpdateRetainer.mockResolvedValue({ id: RETAINER_ID, notes: 'updated' } as never);

    const result = await updateRetainerAction({ retainerId: RETAINER_ID, notes: 'updated' });
    expect(result.success).toBe(true);
  });

  it('rejects update on cancelled retainer', async () => {
    mockGetRetainerById.mockResolvedValue({ id: RETAINER_ID, status: 'cancelled', type: 'hourly_rate' } as never);

    const result = await updateRetainerAction({ retainerId: RETAINER_ID, notes: 'x' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('RETAINER_NOT_ACTIVE');
  });

  it('rejects member role', async () => {
    mockRequireTenantContext.mockResolvedValue({ workspaceId: 'ws1', userId: 'u1', role: 'member' });

    const result = await updateRetainerAction({ retainerId: RETAINER_ID, notes: 'x' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('INSUFFICIENT_ROLE');
  });

  it('returns not found for missing retainer', async () => {
    mockGetRetainerById.mockResolvedValue(null);

    const result = await updateRetainerAction({ retainerId: RETAINER_ID, notes: 'x' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('RETAINER_NOT_FOUND');
  });

  it('type is not in the update schema (immutable)', async () => {
    mockGetRetainerById.mockResolvedValue({ id: RETAINER_ID, status: 'active', type: 'hourly_rate' } as never);
    mockUpdateRetainer.mockResolvedValue({ id: RETAINER_ID, type: 'hourly_rate' } as never);

    const result = await updateRetainerAction({ retainerId: RETAINER_ID, notes: 'test' });
    expect(result.success).toBe(true);
    expect(mockUpdateRetainer).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ data: expect.objectContaining({ notes: 'test' }) }),
    );
  });
});
