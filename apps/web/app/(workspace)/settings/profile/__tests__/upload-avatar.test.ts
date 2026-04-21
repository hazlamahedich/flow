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

import { uploadAvatar } from '../actions/upload-avatar';
import { getServerSupabase } from '@/lib/supabase-server';
import { updateAvatarUrl } from '@flow/db';

const mockGetServerSupabase = vi.mocked(getServerSupabase);
const mockUpdateAvatarUrl = vi.mocked(updateAvatarUrl);

function mockSupabaseWithUser(user: { id: string; email: string } | null) {
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
          single: vi.fn().mockResolvedValue({ data: { avatar_url: null }, error: null }),
        }),
      }),
    }),
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://example.com/signed' },
        }),
        remove: vi.fn().mockResolvedValue({ error: null }),
      }),
    },
  };
}

describe('uploadAvatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns unauthorized when no session', async () => {
    mockGetServerSupabase.mockResolvedValue(mockSupabaseWithUser(null) as never);
    const formData = new FormData();
    const result = await uploadAvatar(formData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('returns error when no file provided', async () => {
    mockGetServerSupabase.mockResolvedValue(mockSupabaseWithUser({ id: 'user-1', email: 'test@test.com' }) as never);
    const formData = new FormData();
    const result = await uploadAvatar(formData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('JPEG');
    }
  });

  it('returns error for oversized file', async () => {
    mockGetServerSupabase.mockResolvedValue(mockSupabaseWithUser({ id: 'user-1', email: 'test@test.com' }) as never);
    const formData = new FormData();
    const largeFile = new File([new ArrayBuffer(2 * 1024 * 1024 + 1)], 'big.jpg', { type: 'image/jpeg' });
    formData.append('avatar', largeFile);
    const result = await uploadAvatar(formData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('2MB');
    }
  });

  it('returns error for SVG with .jpg extension (magic bytes fail)', async () => {
    mockGetServerSupabase.mockResolvedValue(mockSupabaseWithUser({ id: 'user-1', email: 'test@test.com' }) as never);
    const formData = new FormData();
    const svgContent = '<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>';
    const svgFile = new File([svgContent], 'fake.jpg', { type: 'image/jpeg' });
    Object.defineProperty(svgFile, 'arrayBuffer', {
      value: () => Promise.resolve(new TextEncoder().encode(svgContent).buffer),
    });
    formData.append('avatar', svgFile);
    const result = await uploadAvatar(formData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('JPEG');
    }
  });
});
