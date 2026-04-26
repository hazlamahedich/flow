import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getActiveRetainerForClient, getRetainerById, createRetainer, updateRetainer, cancelRetainer } from '../crud';
import type { SupabaseClient } from '@supabase/supabase-js';

function mockClient(returnData: unknown, error: unknown = null) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: returnData, error }),
    single: vi.fn().mockResolvedValue({ data: returnData, error }),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: returnData, error }),
  };
  return chain as unknown as SupabaseClient;
}

describe('getActiveRetainerForClient', () => {
  it('returns null when no active retainer', async () => {
    const client = mockClient(null);
    const result = await getActiveRetainerForClient(client, {
      clientId: 'c1',
      workspaceId: 'w1',
    });
    expect(result).toBeNull();
  });

  it('returns retainer when active exists', async () => {
    const client = mockClient({
      id: 'r1', workspace_id: 'w1', client_id: 'c1', type: 'hourly_rate',
      hourly_rate_cents: 5000, monthly_fee_cents: null, monthly_hours_threshold: null,
      package_hours: null, package_name: null, billing_period_days: 30,
      start_date: '2026-01-01', end_date: null, status: 'active',
      cancelled_at: null, cancellation_reason: null, notes: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
    const result = await getActiveRetainerForClient(client, { clientId: 'c1', workspaceId: 'w1' });
    expect(result).not.toBeNull();
    expect(result?.type).toBe('hourly_rate');
  });

  it('marks as expired when end_date is past', async () => {
    const pastDate = '2020-01-01';
    const client = mockClient({
      id: 'r1', workspace_id: 'w1', client_id: 'c1', type: 'hourly_rate',
      hourly_rate_cents: 5000, monthly_fee_cents: null, monthly_hours_threshold: null,
      package_hours: null, package_name: null, billing_period_days: 30,
      start_date: '2019-01-01', end_date: pastDate, status: 'active',
      cancelled_at: null, cancellation_reason: null, notes: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
    const result = await getActiveRetainerForClient(client, { clientId: 'c1', workspaceId: 'w1' });
    expect(result?.status).toBe('expired');
  });
});

describe('createRetainer', () => {
  it('creates a retainer and returns mapped result', async () => {
    const client = mockClient({
      id: 'r1', workspace_id: 'w1', client_id: 'c1', type: 'hourly_rate',
      hourly_rate_cents: 5000, monthly_fee_cents: null, monthly_hours_threshold: null,
      package_hours: null, package_name: null, billing_period_days: 30,
      start_date: '2026-01-01', end_date: null, status: 'active',
      cancelled_at: null, cancellation_reason: null, notes: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
    const result = await createRetainer(client, {
      workspaceId: 'w1',
      data: { clientId: 'c1', type: 'hourly_rate', hourlyRateCents: 5000 },
    });
    expect(result.type).toBe('hourly_rate');
  });

  it('throws with RETAINER_ACTIVE_EXISTS on unique constraint violation', async () => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { code: '23505', message: 'unique violation' } }),
    };
    const client = chain as unknown as SupabaseClient;

    await expect(createRetainer(client, {
      workspaceId: 'w1',
      data: { clientId: 'c1', type: 'hourly_rate', hourlyRateCents: 5000 },
    })).rejects.toMatchObject({ retainerCode: 'RETAINER_ACTIVE_EXISTS' });
  });
});

describe('cancelRetainer', () => {
  it('throws RETAINER_NOT_ACTIVE for cancelled retainer', async () => {
    const getByIdMock = {
      id: 'r1', workspace_id: 'w1', client_id: 'c1', type: 'hourly_rate',
      hourly_rate_cents: 5000, monthly_fee_cents: null, monthly_hours_threshold: null,
      package_hours: null, package_name: null, billing_period_days: 30,
      start_date: '2026-01-01', end_date: null, status: 'cancelled',
      cancelled_at: new Date().toISOString(), cancellation_reason: 'done',
      notes: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };

    const chain = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: getByIdMock, error: null }),
    };
    const client = chain as unknown as SupabaseClient;

    await expect(cancelRetainer(client, { retainerId: 'r1', workspaceId: 'w1' }))
      .rejects.toThrow('RETAINER_NOT_ACTIVE');
  });
});
