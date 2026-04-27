import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('@flow/db', () => ({
  requireTenantContext: vi.fn(),
  createFlowError: (status: number, code: string, message: string, category: string, details?: unknown) => ({ status, code, message, category, details }),
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

const RETAINER_ID = '00000000-0000-0000-0000-000000000003';

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSupabase.mockResolvedValue({} as never);
  mockRequireTenantContext.mockResolvedValue({ workspaceId: 'ws1', userId: 'u1', role: 'owner' });
});

describe('updateRetainerAction', () => {
  it('updates hourly rate on active retainer', async () => {
    mockGetRetainerById.mockResolvedValue({ id: RETAINER_ID, status: 'active', type: 'hourly_rate' } as never);
    mockUpdateRetainer.mockResolvedValue({ id: RETAINER_ID, status: 'active', hourlyRateCents: 8000 } as never);

    const result = await updateRetainerAction({ retainerId: RETAINER_ID, hourlyRateCents: 8000 });
    expect(result.success).toBe(true);
    expect(mockUpdateRetainer).toHaveBeenCalled();
  });

  it('rejects invalid input', async () => {
    const result = await updateRetainerAction({ retainerId: 'bad' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects member role', async () => {
    mockRequireTenantContext.mockResolvedValue({ workspaceId: 'ws1', userId: 'u1', role: 'member' });
    const result = await updateRetainerAction({ retainerId: RETAINER_ID, hourlyRateCents: 8000 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('INSUFFICIENT_ROLE');
  });

  it('returns 404 for missing retainer', async () => {
    mockGetRetainerById.mockResolvedValue(null);
    const result = await updateRetainerAction({ retainerId: RETAINER_ID, hourlyRateCents: 8000 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('RETAINER_NOT_FOUND');
  });

  it('blocks update on non-active retainer', async () => {
    mockGetRetainerById.mockResolvedValue({ id: RETAINER_ID, status: 'cancelled', type: 'hourly_rate' } as never);
    const result = await updateRetainerAction({ retainerId: RETAINER_ID, hourlyRateCents: 8000 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('RETAINER_NOT_ACTIVE');
  });

  it('handles concurrent cancellation conflict (PGRQ116)', async () => {
    mockGetRetainerById.mockResolvedValue({ id: RETAINER_ID, status: 'active', type: 'hourly_rate' } as never);
    const pgErr = new Error('concurrent') as Error & { code: string };
    pgErr.code = 'PGRQ116';
    mockUpdateRetainer.mockRejectedValue(pgErr as never);

    const result = await updateRetainerAction({ retainerId: RETAINER_ID, hourlyRateCents: 8000 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('RETAINER_NOT_ACTIVE');
  });

  it('handles generic db error', async () => {
    mockGetRetainerById.mockResolvedValue({ id: RETAINER_ID, status: 'active', type: 'hourly_rate' } as never);
    mockUpdateRetainer.mockRejectedValue(new Error('db fail') as never);

    const result = await updateRetainerAction({ retainerId: RETAINER_ID, hourlyRateCents: 8000 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('INTERNAL_ERROR');
  });

  it('rejects mixing fields from different retainer types', async () => {
    const result = await updateRetainerAction({
      retainerId: RETAINER_ID,
      hourlyRateCents: 8000,
      monthlyFeeCents: 50000,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('VALIDATION_ERROR');
  });
});
