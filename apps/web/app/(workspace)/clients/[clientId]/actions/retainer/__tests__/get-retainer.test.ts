import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('@flow/db', () => ({
  requireTenantContext: vi.fn(),
  getActiveRetainerForClient: vi.fn(),
  getRetainerUtilization: vi.fn(),
}));

import { getRetainerDetail } from '../get-retainer';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, getActiveRetainerForClient, getRetainerUtilization } from '@flow/db';

const mockGetServerSupabase = vi.mocked(getServerSupabase);
const mockRequireTenantContext = vi.mocked(requireTenantContext);
const mockGetActiveRetainer = vi.mocked(getActiveRetainerForClient);
const mockGetUtilization = vi.mocked(getRetainerUtilization);

beforeEach(() => {
  vi.clearAllMocks();
  mockGetServerSupabase.mockResolvedValue({} as never);
  mockRequireTenantContext.mockResolvedValue({ workspaceId: 'ws1', userId: 'u1', role: 'owner' });
});

describe('getRetainerDetail', () => {
  it('returns null when no retainer exists', async () => {
    mockGetActiveRetainer.mockResolvedValue(null);

    const result = await getRetainerDetail('00000000-0000-0000-0000-000000000001');
    expect(result.retainer).toBeNull();
    expect(result.utilization).toBeNull();
  });

  it('returns retainer with utilization', async () => {
    mockGetActiveRetainer.mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000002',
      type: 'hourly_rate',
      status: 'active',
    } as never);
    mockGetUtilization.mockResolvedValue({
      totalMinutes: 120,
      allocatedMinutes: 0,
      utilizationPercent: 0,
      billingPeriodStart: '2026-01-01',
      billingPeriodEnd: '2026-01-31',
    });

    const result = await getRetainerDetail('00000000-0000-0000-0000-000000000001');
    expect(result.retainer).not.toBeNull();
    expect(result.utilization).not.toBeNull();
    expect(result.utilization!.totalMinutes).toBe(120);
  });
});
