import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('@flow/db', () => ({
  requireTenantContext: vi.fn(),
  createFlowError: (
    status: number,
    code: string,
    message: string,
    category: string,
  ) => ({
    status,
    code,
    message,
    category,
  }),
}));

import { listClientsForTimerAction } from '../list-clients-for-timer';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext } from '@flow/db';

const mockEq = vi.fn().mockReturnThis();
const mockOrder = vi.fn().mockReturnThis();
const mockSelect = vi.fn().mockReturnValue({ eq: mockEq, order: mockOrder });
const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

const mockSupabase = { from: mockFrom };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSupabase).mockResolvedValue(mockSupabase as never);
  vi.mocked(requireTenantContext).mockResolvedValue({
    workspaceId: 'ws-1',
    userId: 'u-1',
    role: 'owner',
  } as never);
  mockOrder.mockReturnValue([]);
});

describe('listClientsForTimerAction', () => {
  it('[P1] returns active clients sorted by name', async () => {
    mockOrder.mockResolvedValue({
      data: [
        { id: 'c-1', name: 'Alpha Corp' },
        { id: 'c-2', name: 'Beta LLC' },
      ],
      error: null,
    });

    const result = await listClientsForTimerAction();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
      expect(result.data?.[0]?.name).toBe('Alpha Corp');
    }
    expect(mockFrom).toHaveBeenCalledWith('clients');
    expect(mockEq).toHaveBeenCalledWith('workspace_id', 'ws-1');
    expect(mockEq).toHaveBeenCalledWith('status', 'active');
    expect(mockOrder).toHaveBeenCalledWith('name', { ascending: true });
  });

  it('[P1] returns empty array when no clients', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null });

    const result = await listClientsForTimerAction();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([]);
    }
  });

  it('[P1] returns error on database failure', async () => {
    mockOrder.mockResolvedValue({
      data: null,
      error: { message: 'connection refused' },
    });

    const result = await listClientsForTimerAction();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INTERNAL_ERROR');
    }
  });

  it('[P1] returns error when tenant context fails', async () => {
    vi.mocked(requireTenantContext).mockRejectedValue(new Error('no session'));

    const result = await listClientsForTimerAction();

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INTERNAL_ERROR');
    }
  });

  it('[P1] handles null data with fallback to empty array', async () => {
    mockOrder.mockResolvedValue({ data: null, error: null });

    const result = await listClientsForTimerAction();

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([]);
    }
  });
});
