import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('@/lib/workspace-audit', () => ({
  logWorkspaceEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfterMs: 0 }),
  INVITATION_CONFIG: { maxAttempts: 10, windowMs: 3600000 },
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

vi.mock('@flow/db/client', () => ({
  createServiceClient: vi.fn(() => ({
    auth: {
      admin: {
        inviteUserByEmail: vi.fn().mockResolvedValue({ data: {}, error: null }),
      },
    },
  })),
}));

import { inviteMember } from '../invite-member';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext } from '@flow/db';

function setupMocks(overrides: Record<string, unknown> = {}) {
  const supabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { email: 'admin@test.com' } } }) },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              gt: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              }),
            }),
          }),
          single: vi.fn(),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'inv-1', email: 'new@test.com', role: 'member' },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn(),
          }),
        }),
      }),
    }),
    ...overrides,
  };

  vi.mocked(getServerSupabase).mockResolvedValue(supabase as any);
  vi.mocked(requireTenantContext).mockResolvedValue({
    workspaceId: 'ws-1',
    userId: 'user-admin',
    role: 'owner',
  } as any);

  return supabase;
}

describe('inviteMember', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('[P0] returns validation error for invalid input', async () => {
    const result = await inviteMember({ email: 'not-email', role: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('[P0] returns error when member role tries to invite', async () => {
    setupMocks();
    vi.mocked(requireTenantContext).mockResolvedValue({
      workspaceId: 'ws-1',
      userId: 'user-member',
      role: 'member',
    } as any);

    const result = await inviteMember({ email: 'new@test.com', role: 'member' });
    expect(result.success).toBe(false);
  });

  it('[P0] returns error when admin tries to invite admin', async () => {
    setupMocks();
    vi.mocked(requireTenantContext).mockResolvedValue({
      workspaceId: 'ws-1',
      userId: 'user-admin',
      role: 'admin',
    } as any);

    const result = await inviteMember({ email: 'new@test.com', role: 'admin' });
    expect(result.success).toBe(false);
  });

  it('[P0] returns error when inviting self', async () => {
    setupMocks();
    vi.mocked(requireTenantContext).mockResolvedValue({
      workspaceId: 'ws-1',
      userId: 'user-admin',
      role: 'owner',
    } as any);

    const supabase = await getServerSupabase();
    supabase.auth.getUser.mockResolvedValue({ data: { user: { email: 'admin@test.com' } } });

    const result = await inviteMember({ email: 'admin@test.com', role: 'member' });
    expect(result.success).toBe(false);
  });

  it('[P0] creates new invitation successfully', async () => {
    setupMocks();

    const result = await inviteMember({ email: 'new@test.com', role: 'member' });
    expect(result.success).toBe(true);
  });

  it('[P1] handles duplicate member (23505 error) on insert', async () => {
    const supabase = setupMocks();
    supabase.from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              gt: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null }),
              }),
            }),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: '23505', message: 'duplicate' },
          }),
        }),
      }),
    });

    const result = await inviteMember({ email: 'existing@test.com', role: 'member' });
    expect(result.success).toBe(false);
  });
});
