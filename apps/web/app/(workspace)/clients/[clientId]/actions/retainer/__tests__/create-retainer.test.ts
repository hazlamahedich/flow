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

const VALID_CLIENT_ID = '00000000-0000-0000-0000-000000000001';

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
    const mockRetainer = { id: 'r1', type: 'hourly_rate', status: 'active' };
    mockCreateRetainer.mockResolvedValue(mockRetainer as never);

    const result = await createRetainerAction({
      type: 'hourly_rate',
      clientId: VALID_CLIENT_ID,
      hourlyRateCents: 5000,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.type).toBe('hourly_rate');
  });

  it('rejects member role', async () => {
    mockRequireTenantContext.mockResolvedValue({ workspaceId: 'ws1', userId: 'u1', role: 'member' });

    const result = await createRetainerAction({
      type: 'hourly_rate',
      clientId: VALID_CLIENT_ID,
      hourlyRateCents: 5000,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('INSUFFICIENT_ROLE');
  });

  it('rejects archived client', async () => {
    const archivedSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(() => Promise.resolve({ data: { status: 'archived' }, error: null })),
            })),
          })),
        })),
      })),
    };
    mockGetServerSupabase.mockResolvedValue(archivedSupabase as never);

    const result = await createRetainerAction({
      type: 'hourly_rate',
      clientId: VALID_CLIENT_ID,
      hourlyRateCents: 5000,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('RETAINER_CLIENT_ARCHIVED');
  });

  it('catches unique constraint violation (RETAINER_ACTIVE_EXISTS)', async () => {
    const err = new Error('unique') as Error & { retainerCode: string };
    err.retainerCode = 'RETAINER_ACTIVE_EXISTS';
    mockCreateRetainer.mockRejectedValue(err);

    const result = await createRetainerAction({
      type: 'hourly_rate',
      clientId: VALID_CLIENT_ID,
      hourlyRateCents: 5000,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('RETAINER_ACTIVE_EXISTS');
  });

  it('rejects invalid input', async () => {
    const result = await createRetainerAction({ type: 'invalid' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  it('uses success discriminant (not ok)', async () => {
    const result = await createRetainerAction({ type: 'hourly_rate' });
    expect('success' in result).toBe(true);
    expect('ok' in result).toBe(false);
  });
});
