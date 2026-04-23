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

vi.mock('@flow/auth/server-admin', () => ({
  invalidateUserSessions: vi.fn().mockResolvedValue(undefined),
}));

import { revokeMember } from '../revoke-member';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext } from '@flow/db';
import { invalidateUserSessions } from '@flow/auth/server-admin';

function setupMocks(targetMember: Record<string, unknown> = {}) {
  const supabase = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  user_id: 'user-target',
                  role: 'member',
                  status: 'active',
                  ...targetMember,
                },
              }),
              count: vi.fn(),
            }),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      }),
    }),
  };

  vi.mocked(getServerSupabase).mockResolvedValue(supabase as any);
  vi.mocked(requireTenantContext).mockResolvedValue({
    workspaceId: 'ws-1',
    userId: 'user-owner',
    role: 'owner',
  } as any);

  return supabase;
}

describe('revokeMember', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('[P0] returns validation error for invalid input', async () => {
    const result = await revokeMember({ memberId: 'not-uuid' });
    expect(result.success).toBe(false);
  });

  it('[P0] returns error when non-owner tries to revoke', async () => {
    setupMocks();
    vi.mocked(requireTenantContext).mockResolvedValue({
      workspaceId: 'ws-1',
      userId: 'user-admin',
      role: 'admin',
    } as any);

    const result = await revokeMember({ memberId: '550e8400-e29b-41d4-a716-446655440000' });
    expect(result.success).toBe(false);
  });

  it('[P0] returns error when member not found', async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null }),
              }),
            }),
          }),
        }),
      }),
      update: vi.fn(),
    };

    vi.mocked(getServerSupabase).mockResolvedValue(supabase as any);
    vi.mocked(requireTenantContext).mockResolvedValue({
      workspaceId: 'ws-1',
      userId: 'user-owner',
      role: 'owner',
    } as any);

    const result = await revokeMember({ memberId: '550e8400-e29b-41d4-a716-446655440000' });
    expect(result.success).toBe(false);
  });

  it('[P0] returns error when trying to revoke self', async () => {
    setupMocks({ user_id: 'user-owner' });

    const result = await revokeMember({ memberId: '550e8400-e29b-41d4-a716-446655440000' });
    expect(result.success).toBe(false);
  });

  it('[P0] revokes member and invalidates sessions', async () => {
    setupMocks();

    const result = await revokeMember({ memberId: '550e8400-e29b-41d4-a716-446655440000' });
    expect(result.success).toBe(true);
    expect(invalidateUserSessions).toHaveBeenCalledWith('user-target');
  });
});
