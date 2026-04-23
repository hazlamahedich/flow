import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@flow/db', () => ({
  createAdminSupabase: vi.fn(),
}));

import { switchWorkspace } from './switch-workspace';
import { getServerSupabase } from '@/lib/supabase-server';
import { createAdminSupabase } from '@flow/db';

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockAuthAdminGetUserById = vi.fn();
const mockAuthAdminUpdateUserById = vi.fn();
const mockRefreshSession = vi.fn();

function setupMocks() {
  const serverClient = {
    auth: { getUser: mockGetUser, refreshSession: mockRefreshSession },
    from: mockFrom,
  };

  const adminClient = {
    auth: {
      admin: {
        getUserById: mockAuthAdminGetUserById,
        updateUserById: mockAuthAdminUpdateUserById,
      },
    },
  };

  vi.mocked(getServerSupabase).mockResolvedValue(serverClient as never);
  vi.mocked(createAdminSupabase).mockReturnValue(adminClient as never);
  return { serverClient, adminClient };
}

beforeEach(() => {
  vi.clearAllMocks();
  setupMocks();
});

describe('switchWorkspace', () => {
  const workspaceId = '00000000-0000-0000-0000-000000000001';
  const userId = '00000000-0000-0000-0000-000000000002';

  it('switches workspace for valid member', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: userId, app_metadata: { workspace_id: 'old-ws' } } },
      error: null,
    });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { workspace_id: workspaceId },
        error: null,
      }),
    });

    mockAuthAdminGetUserById.mockResolvedValue({
      data: { user: { id: userId, app_metadata: {} } },
      error: null,
    });

    mockAuthAdminUpdateUserById.mockResolvedValue({ error: null });
    mockRefreshSession.mockResolvedValue({ error: null });

    const result = await switchWorkspace(workspaceId);

    expect(result).toBeUndefined();
    expect(mockAuthAdminUpdateUserById).toHaveBeenCalledWith(userId, {
      app_metadata: { workspace_id: workspaceId },
    });
  });

  it('throws for non-member', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    });

    await expect(switchWorkspace(workspaceId)).rejects.toThrow('not a member');
  });

  it('throws for unauthenticated user', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Not authenticated' },
    });

    await expect(switchWorkspace(workspaceId)).rejects.toThrow('Authentication required');
  });

  it('throws when update fails', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    });

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { workspace_id: workspaceId },
        error: null,
      }),
    });

    mockAuthAdminGetUserById.mockResolvedValue({
      data: { user: { id: userId, app_metadata: {} } },
      error: null,
    });

    mockAuthAdminUpdateUserById.mockResolvedValue({
      error: { message: 'Update failed' },
    });

    await expect(switchWorkspace(workspaceId)).rejects.toThrow('Failed to update workspace');
  });
});
