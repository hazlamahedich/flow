import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

import { getPendingEmailChange } from '../actions/get-pending-email-change';
import { getServerSupabase } from '@/lib/supabase-server';

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

describe('getPendingEmailChange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns unauthorized when no session', async () => {
    mockGetServerSupabase.mockResolvedValue(mockSupabaseWithUser(null) as never);
    const result = await getPendingEmailChange(null);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('returns pending=true with data when pending request exists', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gt: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  new_email: 'pending@test.com',
                  expires_at: '2099-01-01T00:00:00Z',
                },
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

    const result = await getPendingEmailChange(null);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pending).toBe(true);
      expect(result.data.newEmail).toBe('pending@test.com');
      expect(result.data.expiresAt).toBe('2099-01-01T00:00:00Z');
    }
  });

  it('returns pending=false when no pending request', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gt: vi.fn().mockReturnValue({
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

    const result = await getPendingEmailChange(null);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pending).toBe(false);
      expect(result.data.newEmail).toBeNull();
    }
  });
});
