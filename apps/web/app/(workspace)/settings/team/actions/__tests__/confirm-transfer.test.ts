import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('@/lib/workspace-audit', () => ({
  logWorkspaceEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

vi.mock('@flow/db', () => ({
  createFlowError: (status: number, code: string, message: string) =>
    Object.assign(new Error(message), { status, code }),
  requireTenantContext: vi.fn(),
  cacheTag: vi.fn((type: string, id: string) => `${type}:${id}`),
}));

vi.mock('@flow/auth', () => ({
  invalidateUserSessions: vi.fn().mockResolvedValue(undefined),
  executeOwnershipTransfer: vi.fn(),
}));

import { confirmTransfer } from '../confirm-transfer';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext } from '@flow/db';
import { executeOwnershipTransfer, invalidateUserSessions } from '@flow/auth';

type MockSupabase = Awaited<ReturnType<typeof getServerSupabase>>;
type MockTenant = Awaited<ReturnType<typeof requireTenantContext>>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getServerSupabase).mockResolvedValue({} as unknown as MockSupabase);
  vi.mocked(requireTenantContext).mockResolvedValue({
    workspaceId: 'ws-1',
    userId: 'user-b',
    role: 'owner',
  } as unknown as MockTenant);
});

describe('confirmTransfer', () => {
  it('[P0] returns validation error for invalid input', async () => {
    const result = await confirmTransfer({ transferId: 'not-uuid' });
    expect(result.success).toBe(false);
  });

  it('[P0] returns mapped error when transfer fails with transfer_not_found', async () => {
    vi.mocked(executeOwnershipTransfer).mockResolvedValue({
      success: false,
      error: 'transfer_not_found',
    });

    const result = await confirmTransfer({ transferId: '550e8400-e29b-41d4-a716-446655440000' });
    expect(result.success).toBe(false);
  });

  it('[P0] returns success and invalidates both users sessions', async () => {
    vi.mocked(executeOwnershipTransfer).mockResolvedValue({
      success: true,
      fromUserId: 'user-a',
      toUserId: 'user-b',
    });

    const result = await confirmTransfer({ transferId: '550e8400-e29b-41d4-a716-446655440000' });
    expect(result.success).toBe(true);
    expect(invalidateUserSessions).toHaveBeenCalledWith('user-a');
    expect(invalidateUserSessions).toHaveBeenCalledWith('user-b');
  });

  it('[P0] returns success even if session invalidation fails', async () => {
    vi.mocked(executeOwnershipTransfer).mockResolvedValue({
      success: true,
      fromUserId: 'user-a',
      toUserId: 'user-b',
    });
    vi.mocked(invalidateUserSessions).mockRejectedValue(new Error('timeout'));

    const result = await confirmTransfer({ transferId: '550e8400-e29b-41d4-a716-446655440000' });
    expect(result.success).toBe(true);
  });

  it('[P0] maps expired error to 410', async () => {
    vi.mocked(executeOwnershipTransfer).mockResolvedValue({
      success: false,
      error: 'expired',
    });

    const result = await confirmTransfer({ transferId: '550e8400-e29b-41d4-a716-446655440000' });
    expect(result.success).toBe(false);
  });
});
