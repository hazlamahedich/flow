import { describe, it, expect, vi } from 'vitest';
import { getUserProfile } from './get-user-profile';

function mockClient(overrides: Record<string, unknown> = {}) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'user-1',
              name: 'Test User',
              email: 'test@example.com',
              timezone: 'America/New_York',
              avatar_url: null,
              updated_at: '2024-01-01T00:00:00Z',
            },
            error: null,
          }),
        }),
      }),
    }),
    storage: {
      from: vi.fn().mockReturnValue({
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://storage.example.com/signed-avatar.jpg' },
        }),
      }),
    },
    ...overrides,
  } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

describe('getUserProfile', () => {
  it('[P1] returns null when query errors', async () => {
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
          }),
        }),
      }),
    } as unknown as import('@supabase/supabase-js').SupabaseClient;

    const result = await getUserProfile(client, 'user-1');
    expect(result).toBeNull();
  });

  it('[P1] returns profile with null avatar when no avatar_url', async () => {
    const client = mockClient();
    const result = await getUserProfile(client, 'user-1');

    expect(result).toEqual({
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
      timezone: 'America/New_York',
      avatarUrl: null,
      updatedAt: '2024-01-01T00:00:00Z',
    });
  });

  it('[P1] generates signed URL for storage-path avatar', async () => {
    const client = mockClient();
    const single = client.from('users').select('id, name, email, timezone, avatar_url, updated_at').eq('id', 'user-1').single;
    vi.mocked(single).mockResolvedValue({
      data: {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        timezone: 'UTC',
        avatar_url: 'avatars/user-1/photo.jpg',
        updated_at: '2024-01-01T00:00:00Z',
      },
      error: null,
    } as Awaited<ReturnType<typeof single>>);

    const result = await getUserProfile(client, 'user-1');
    expect(result?.avatarUrl).toBe('https://storage.example.com/signed-avatar.jpg');
    expect(client.storage.from).toHaveBeenCalledWith('avatars');
  });

  it('[P1] keeps HTTP avatar URL as-is', async () => {
    const client = mockClient();
    const single = client.from('users').select('id, name, email, timezone, avatar_url, updated_at').eq('id', 'user-1').single;
    vi.mocked(single).mockResolvedValue({
      data: {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        timezone: 'UTC',
        avatar_url: 'https://gravatar.com/avatar/abc',
        updated_at: '2024-01-01T00:00:00Z',
      },
      error: null,
    } as Awaited<ReturnType<typeof single>>);

    const result = await getUserProfile(client, 'user-1');
    expect(result?.avatarUrl).toBe('https://gravatar.com/avatar/abc');
  });
});
