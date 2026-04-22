import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

import { cancelEmailChange } from '../actions/cancel-email-change';
import { getServerSupabase } from '@/lib/supabase-server';
import { revalidateTag } from 'next/cache';

const mockGetServerSupabase = vi.mocked(getServerSupabase);

function mockSupabaseWithUser(user: { id: string } | null) {
  const authResult = user
    ? { data: { user }, error: null }
    : { data: { user: null }, error: { message: 'Session expired' } };
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue(authResult),
    },
    from: vi.fn(),
  };
}

describe('cancelEmailChange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns unauthorized when no session', async () => {
    mockGetServerSupabase.mockResolvedValue(mockSupabaseWithUser(null) as never);
    const result = await cancelEmailChange(null);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('cancels pending request successfully', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'request-1' },
                error: null,
              }),
            }),
          }),
        }),
      }),
    });

    mockGetServerSupabase.mockResolvedValue({
      ...mockSupabaseWithUser({ id: 'user-1' }),
      from: mockFrom,
    } as never);

    const result = await cancelEmailChange(null);
    expect(result.success).toBe(true);
    expect(revalidateTag).toHaveBeenCalledWith('users:user-1');
  });

  it('returns already-applied error when no pending request', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
        }),
      }),
    });

    mockGetServerSupabase.mockResolvedValue({
      ...mockSupabaseWithUser({ id: 'user-1' }),
      from: mockFrom,
    } as never);

    const result = await cancelEmailChange(null);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('EMAIL_CHANGE_ALREADY_APPLIED');
      expect(result.error.message).toContain('already been changed');
    }
  });

  it('returns internal error on database error', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'DB error' },
              }),
            }),
          }),
        }),
      }),
    });

    mockGetServerSupabase.mockResolvedValue({
      ...mockSupabaseWithUser({ id: 'user-1' }),
      from: mockFrom,
    } as never);

    const result = await cancelEmailChange(null);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INTERNAL_ERROR');
    }
  });
});
