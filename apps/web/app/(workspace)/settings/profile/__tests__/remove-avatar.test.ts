import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

vi.mock('@flow/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('@flow/db')>();
  return {
    ...original,
    ensureUserProfile: vi.fn(),
    updateAvatarUrl: vi.fn(),
  };
});

import { removeAvatar } from '../actions/remove-avatar';
import { getServerSupabase } from '@/lib/supabase-server';
import { updateAvatarUrl } from '@flow/db';
import { revalidateTag } from 'next/cache';

const mockGetServerSupabase = vi.mocked(getServerSupabase);
const mockUpdateAvatarUrl = vi.mocked(updateAvatarUrl);

function mockSupabaseWithUser(user: { id: string; email: string } | null, avatarUrl: string | null = null) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: user ? null : { message: 'Session expired' },
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { avatar_url: avatarUrl }, error: null }),
        }),
      }),
    }),
    storage: {
      from: vi.fn().mockReturnValue({
        remove: vi.fn().mockResolvedValue({ error: null }),
      }),
    },
  };
}

describe('removeAvatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns unauthorized when no session', async () => {
    mockGetServerSupabase.mockResolvedValue(mockSupabaseWithUser(null) as never);
    const result = await removeAvatar();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('removes avatar and sets avatar_url to null', async () => {
    mockGetServerSupabase.mockResolvedValue(
      mockSupabaseWithUser({ id: 'user-1', email: 'test@test.com' }, '/avatars/user-1/old.jpg') as never,
    );
    mockUpdateAvatarUrl.mockResolvedValue(undefined);

    const result = await removeAvatar();
    expect(result.success).toBe(true);
    expect(mockUpdateAvatarUrl).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      null,
    );
  });

  it('succeeds even when no avatar to remove', async () => {
    mockGetServerSupabase.mockResolvedValue(
      mockSupabaseWithUser({ id: 'user-1', email: 'test@test.com' }, null) as never,
    );
    mockUpdateAvatarUrl.mockResolvedValue(undefined);

    const result = await removeAvatar();
    expect(result.success).toBe(true);
    expect(mockUpdateAvatarUrl).toHaveBeenCalledWith(expect.anything(), 'user-1', null);
  });
});
