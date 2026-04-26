import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('@flow/db', () => ({
  requireTenantContext: vi.fn(),
  createFlowError: (status: number, code: string, message: string, category: string) => ({ status, code, message, category }),
  cacheTag: vi.fn((entity: string, id: string) => `${entity}:${id}`),
  cancelRetainer: vi.fn(),
  getRetainerById: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

import { cancelRetainerAction } from '../cancel-retainer';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, cancelRetainer, getRetainerById } from '@flow/db';

const mockGetServerSupabase = vi.mocked(getServerSupabase);
const mockRequireTenantContext = vi.mocked(requireTenantContext);
const mockCancelRetainer = vi.mocked(cancelRetainer);
const mockGetRetainerById = vi.mocked(getRetainerById);

const RETAINER_ID = '00000000-0000-0000-0000-000000000003';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSupabase.mockResolvedValue({} as never);
  mockRequireTenantContext.mockResolvedValue({ workspaceId: 'ws1', userId: 'u1', role: 'owner' });
});

describe('cancelRetainerAction', () => {
  it('cancels an active retainer', async () => {
    mockGetRetainerById.mockResolvedValue({ id: RETAINER_ID, status: 'active', type: 'hourly_rate' } as never);
    mockCancelRetainer.mockResolvedValue({ id: RETAINER_ID, status: 'cancelled' } as never);

    const result = await cancelRetainerAction({ retainerId: RETAINER_ID });
    expect(result.success).toBe(true);
  });

  it('handles already cancelled retainer (idempotent)', async () => {
    mockGetRetainerById.mockResolvedValue({ id: RETAINER_ID, status: 'cancelled', type: 'hourly_rate' } as never);
    mockCancelRetainer.mockResolvedValue({ id: RETAINER_ID, status: 'cancelled' } as never);

    const result = await cancelRetainerAction({ retainerId: RETAINER_ID });
    expect(result.success).toBe(true);
  });

  it('stores cancellation reason', async () => {
    mockGetRetainerById.mockResolvedValue({ id: RETAINER_ID, status: 'active', type: 'hourly_rate' } as never);
    mockCancelRetainer.mockResolvedValue({ id: RETAINER_ID, status: 'cancelled', cancellationReason: 'Client ended' } as never);

    const result = await cancelRetainerAction({ retainerId: RETAINER_ID, reason: 'Client ended' });
    expect(result.success).toBe(true);
    expect(mockCancelRetainer).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ reason: 'Client ended' }));
  });

  it('rejects member role', async () => {
    mockRequireTenantContext.mockResolvedValue({ workspaceId: 'ws1', userId: 'u1', role: 'member' });

    const result = await cancelRetainerAction({ retainerId: RETAINER_ID });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('INSUFFICIENT_ROLE');
  });

  it('returns not found for missing retainer', async () => {
    mockGetRetainerById.mockResolvedValue(null);

    const result = await cancelRetainerAction({ retainerId: '00000000-0000-0000-0000-000000009999' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('RETAINER_NOT_FOUND');
  });
});
