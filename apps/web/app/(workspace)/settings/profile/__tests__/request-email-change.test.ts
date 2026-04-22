import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('@flow/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('@flow/db')>();
  return {
    ...original,
    requestEmailChangeAtomic: vi.fn(),
  };
});

vi.mock('crypto', async (importOriginal) => {
  const original = await importOriginal<typeof import('crypto')>();
  return {
    ...original,
    randomUUID: vi.fn().mockReturnValue('mock-uuid-token'),
  };
});

import { requestEmailChange } from '../actions/request-email-change';
import { getServerSupabase } from '@/lib/supabase-server';
import { requestEmailChangeAtomic } from '@flow/db';

const mockGetServerSupabase = vi.mocked(getServerSupabase);
const mockRequestEmailChangeAtomic = vi.mocked(requestEmailChangeAtomic);

function mockSupabaseWithUser(user: { id: string; email: string } | null) {
  const authResult = user
    ? { data: { user }, error: null }
    : { data: { user: null }, error: { message: 'Session expired' } };
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue(authResult),
      updateUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    }),
  };
}

describe('requestEmailChange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns validation error for invalid email', async () => {
    const result = await requestEmailChange({ newEmail: 'bad-email' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns unauthorized when no session', async () => {
    mockGetServerSupabase.mockResolvedValue(mockSupabaseWithUser(null) as never);
    const result = await requestEmailChange({ newEmail: 'new@test.com' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('returns error when new email same as current', async () => {
    mockGetServerSupabase.mockResolvedValue(
      mockSupabaseWithUser({ id: 'user-1', email: 'same@test.com' }) as never,
    );
    const result = await requestEmailChange({ newEmail: 'same@test.com' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toContain('already your email');
    }
  });

  it('returns rate-limited error when quota exceeded', async () => {
    mockGetServerSupabase.mockResolvedValue(
      mockSupabaseWithUser({ id: 'user-1', email: 'old@test.com' }) as never,
    );
    mockRequestEmailChangeAtomic.mockResolvedValue({
      allowed: false,
      wasInserted: false,
      pendingExists: false,
      pendingNewEmail: null,
      requestCount: 5,
    });

    const result = await requestEmailChange({ newEmail: 'new@test.com' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('EMAIL_CHANGE_RATE_LIMITED');
    }
  });

  it('returns pending error when pending request exists', async () => {
    mockGetServerSupabase.mockResolvedValue(
      mockSupabaseWithUser({ id: 'user-1', email: 'old@test.com' }) as never,
    );
    mockRequestEmailChangeAtomic.mockResolvedValue({
      allowed: true,
      wasInserted: false,
      pendingExists: true,
      pendingNewEmail: 'pending@test.com',
      requestCount: 0,
    });

    const result = await requestEmailChange({ newEmail: 'new@test.com' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('EMAIL_CHANGE_PENDING');
      expect(result.error.message).toContain('pending@test.com');
    }
  });

  it('returns email unavailable when Supabase rejects with duplicate', async () => {
    mockGetServerSupabase.mockResolvedValue(
      mockSupabaseWithUser({ id: 'user-1', email: 'old@test.com' }) as never,
    );
    mockRequestEmailChangeAtomic.mockResolvedValue({
      allowed: true,
      wasInserted: true,
      pendingExists: false,
      pendingNewEmail: null,
      requestCount: 0,
    });

    const supabase = await mockGetServerSupabase();
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      data: { user: null },
      error: { message: 'Email address is already registered', name: 'AuthError' } as never,
    });

    const result = await requestEmailChange({ newEmail: 'taken@test.com' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('EMAIL_UNAVAILABLE');
      expect(result.error.message).not.toContain('registered');
      expect(result.error.message).toContain("isn't available");
    }
  });

  it('succeeds on happy path', async () => {
    mockGetServerSupabase.mockResolvedValue(
      mockSupabaseWithUser({ id: 'user-1', email: 'old@test.com' }) as never,
    );
    mockRequestEmailChangeAtomic.mockResolvedValue({
      allowed: true,
      wasInserted: true,
      pendingExists: false,
      pendingNewEmail: null,
      requestCount: 0,
    });

    const result = await requestEmailChange({ newEmail: 'new@test.com' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pendingEmail).toBe('new@test.com');
    }
  });
});
