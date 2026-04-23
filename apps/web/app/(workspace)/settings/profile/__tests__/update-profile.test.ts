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

function generateUserId() {
  return crypto.randomUUID();
}

function generateEmail() {
  return `test-${Date.now()}@example.com`;
}

describe('updateProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns validation error for empty name', async () => {
    const result = await updateProfile({ name: '', timezone: 'UTC' });
    expect(result.success).toBe(false);
    expect(result.success === false && result.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns unauthorized when no session', async () => {
    mockGetServerSupabase.mockResolvedValue(mockSupabaseWithUser(null) as never);
    const result = await updateProfile({ name: 'Valid Name', timezone: 'UTC' });
    expect(result.success).toBe(false);
    expect(result.success === false && result.error.code).toBe('UNAUTHORIZED');
  });

  it('updates profile and revalidates cache on success', async () => {
    const userId = generateUserId();
    const email = generateEmail();
    const mockUser = { id: userId, email };
    const mockProfile = {
      id: userId,
      name: 'Updated Name',
      email,
      timezone: 'America/New_York',
      avatarUrl: null,
      updatedAt: new Date().toISOString(),
    };

    mockGetServerSupabase.mockResolvedValue(mockSupabaseWithUser(mockUser) as never);
    mockUpdateUserProfile.mockResolvedValue(undefined);
    mockGetUserProfile.mockResolvedValue(mockProfile);

    const result = await updateProfile({ name: 'Updated Name', timezone: 'America/New_York' });

    expect(result.success).toBe(true);
    expect(result.success === true && result.data.name).toBe('Updated Name');

    expect(mockUpdateUserProfile).toHaveBeenCalledWith(
      expect.anything(),
      userId,
      { name: 'Updated Name', timezone: 'America/New_York' },
    );
    expect(revalidateTag).toHaveBeenCalledWith(`users:${userId}`);
  });
});
