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
    getUserProfile: vi.fn(),
    updateUserProfile: vi.fn(),
    updateAvatarUrl: vi.fn(),
  };
});

import { updateProfile } from '../actions/update-profile';
import { getServerSupabase } from '@/lib/supabase-server';
import { revalidateTag } from 'next/cache';
import { getUserProfile, updateUserProfile } from '@flow/db';

const mockGetServerSupabase = vi.mocked(getServerSupabase);
const mockGetUserProfile = vi.mocked(getUserProfile);
const mockUpdateUserProfile = vi.mocked(updateUserProfile);

function mockSupabaseWithUser(user: { id: string; email: string } | null) {
  const authResult = user
    ? { data: { user }, error: null }
    : { data: { user: null }, error: { message: 'Session expired' } };
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue(authResult),
    },
  };
}

describe('updateProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns validation error for empty name', async () => {
    const result = await updateProfile({ name: '', timezone: 'UTC' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
      expect(result.error.message).toContain('1 and 100');
    }
  });

  it('returns unauthorized when no session', async () => {
    mockGetServerSupabase.mockResolvedValue(mockSupabaseWithUser(null) as never);
    const result = await updateProfile({ name: 'Valid Name', timezone: 'UTC' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('updates profile and revalidates cache on success', async () => {
    const mockUser = { id: 'user-1', email: 'test@test.com' };
    const mockProfile = {
      id: 'user-1',
      name: 'Updated Name',
      email: 'test@test.com',
      timezone: 'America/New_York',
      avatarUrl: null,
      updatedAt: new Date().toISOString(),
    };

    mockGetServerSupabase.mockResolvedValue(mockSupabaseWithUser(mockUser) as never);
    mockUpdateUserProfile.mockResolvedValue(undefined);
    mockGetUserProfile.mockResolvedValue(mockProfile);

    const result = await updateProfile({ name: 'Updated Name', timezone: 'America/New_York' });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Updated Name');
      expect(result.data.timezone).toBe('America/New_York');
    }

    expect(mockUpdateUserProfile).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      { name: 'Updated Name', timezone: 'America/New_York' },
    );
    expect(revalidateTag).toHaveBeenCalledWith('users:user-1');
  });
});
