import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('@flow/db', () => ({
  requireTenantContext: vi.fn(),
  createFlowError: (status: number, code: string, message: string, category: string, details?: unknown) => ({ status, code, message, category, details }),
  cacheTag: vi.fn((entity: string, id: string) => `${entity}:${id}`),
  createRetainer: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

import { createRetainerAction } from '../create-retainer';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, createRetainer } from '@flow/db';

const mockGetServerSupabase = vi.mocked(getServerSupabase);
const mockRequireTenantContext = vi.mocked(requireTenantContext);
const mockCreateRetainer = vi.mocked(createRetainer);

const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() => Promise.resolve({ data: { status: 'active' }, error: null })),
        })),
      })),
    })),
  })),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSupabase.mockResolvedValue(mockSupabase as never);
  mockRequireTenantContext.mockResolvedValue({ workspaceId: 'ws1', userId: 'u1', role: 'owner' });
});

describe('createRetainerAction', () => {
  it('creates hourly_rate retainer', async () => {
    mockCreateRetainer.mockResolvedValue({ id: 'r1', type: 'hourly_rate', status: 'active' } as never);
    const result = await createRetainerAction({
      type: 'hourly_rate',
      clientId: '00000000-0000-0000-0000-000000000001',
      hourlyRateCents: 7500,
    });
    expect(result.success).toBe(true);
    expect(mockCreateRetainer).toHaveBeenCalled();
  });

  it('creates flat_monthly retainer', async () => {
    mockCreateRetainer.mockResolvedValue({ id: 'r2', type: 'flat_monthly', status: 'active' } as never);
    const result = await createRetainerAction({
      type: 'flat_monthly',
      clientId: '00000000-0000-0000-0000-000000000001',
      monthlyFeeCents: 150000,
      monthlyHoursThreshold: '40',
    });
    expect(result.success).toBe(true);
  });

  it('creates package_based retainer', async () => {
    mockCreateRetainer.mockResolvedValue({ id: 'r3', type: 'package_based', status: 'active' } as never);
    const result = await createRetainerAction({
      type: 'package_based',
      clientId: '00000000-0000-0000-0000-000000000001',
      packageHours: '20',
      packageName: 'Basic Support',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid input', async () => {
    const result = await createRetainerAction({ type: 'invalid', clientId: 'x' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects member role', async () => {
    mockRequireTenantContext.mockResolvedValue({ workspaceId: 'ws1', userId: 'u1', role: 'member' });
    const result = await createRetainerAction({
      type: 'hourly_rate',
      clientId: '00000000-0000-0000-0000-000000000001',
      hourlyRateCents: 7500,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('INSUFFICIENT_ROLE');
  });

  it('returns 404 when client not found', async () => {
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      })),
    } as never);
    const result = await createRetainerAction({
      type: 'hourly_rate',
      clientId: '00000000-0000-0000-0000-000000000099',
      hourlyRateCents: 7500,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('CLIENT_NOT_FOUND');
  });

  it('blocks retainer for archived client', async () => {
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({ data: { status: 'archived' }, error: null })),
          })),
        })),
      })),
    } as never);
    const result = await createRetainerAction({
      type: 'hourly_rate',
      clientId: '00000000-0000-0000-0000-000000000001',
      hourlyRateCents: 7500,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('RETAINER_CLIENT_ARCHIVED');
  });

  it('handles active retainer conflict (409)', async () => {
    const conflictErr = new Error('conflict') as Error & { retainerCode: string };
    conflictErr.retainerCode = 'RETAINER_ACTIVE_EXISTS';
    mockCreateRetainer.mockRejectedValue(conflictErr as never);
    const result = await createRetainerAction({
      type: 'hourly_rate',
      clientId: '00000000-0000-0000-0000-000000000001',
      hourlyRateCents: 7500,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('RETAINER_ACTIVE_EXISTS');
  });

  it('handles generic db error', async () => {
    mockCreateRetainer.mockRejectedValue(new Error('db fail') as never);
    const result = await createRetainerAction({
      type: 'hourly_rate',
      clientId: '00000000-0000-0000-0000-000000000001',
      hourlyRateCents: 7500,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('INTERNAL_ERROR');
  });

  it('allows admin to create retainer', async () => {
    mockRequireTenantContext.mockResolvedValue({ workspaceId: 'ws1', userId: 'u1', role: 'admin' });
    mockCreateRetainer.mockResolvedValue({ id: 'r4', type: 'hourly_rate', status: 'active' } as never);
    const result = await createRetainerAction({
      type: 'hourly_rate',
      clientId: '00000000-0000-0000-0000-000000000001',
      hourlyRateCents: 9000,
    });
    expect(result.success).toBe(true);
  });
});
