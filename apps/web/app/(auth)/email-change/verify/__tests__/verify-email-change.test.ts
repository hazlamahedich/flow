import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('@flow/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('@flow/db')>();
  return {
    ...original,
    syncUserEmail: vi.fn(),
    createServiceClient: vi.fn(),
    cacheTag: original.cacheTag,
  };
});

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
}));

import { GET } from '../route';
import { getServerSupabase } from '@/lib/supabase-server';
import { createServiceClient, syncUserEmail } from '@flow/db';
import { revalidateTag } from 'next/cache';

const mockGetServerSupabase = vi.mocked(getServerSupabase);
const mockCreateServiceClient = vi.mocked(createServiceClient);
const mockSyncUserEmail = vi.mocked(syncUserEmail);

function createMockRequest(url: string) {
  return new Request(url) as never;
}

function makeUpdateChain(returnValue: { data: unknown; error: unknown }) {
  return {
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gt: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue(returnValue),
            }),
          }),
        }),
      }),
    }),
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gt: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue(returnValue),
          }),
        }),
      }),
    }),
  };
}

describe('GET /email-change/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects to expired when no token provided', async () => {
    const req = createMockRequest('http://localhost/email-change/verify');
    const response = await GET(req);
    const url = new URL(response.headers.get('location') ?? '');
    expect(url.pathname).toBe('/settings/profile');
    expect(url.searchParams.get('email_error')).toBe('expired');
  });

  it('redirects to email-changed when claim succeeds', async () => {
    const claimed = { user_id: 'user-1', new_email: 'new@test.com' };

    mockGetServerSupabase.mockResolvedValue({
      from: vi.fn().mockReturnValue(makeUpdateChain({ data: claimed, error: null })),
    } as never);

    mockCreateServiceClient.mockReturnValue({
      auth: { admin: { signOut: vi.fn().mockResolvedValue({ data: {}, error: null }) } },
    } as never);

    mockSyncUserEmail.mockResolvedValue(undefined);

    const req = createMockRequest('http://localhost/email-change/verify?token=abc-123');
    const response = await GET(req);
    const url = new URL(response.headers.get('location') ?? '');
    expect(url.pathname).toBe('/login');
    expect(url.searchParams.get('message')).toBe('email-changed');
    expect(mockSyncUserEmail).toHaveBeenCalled();
  });

  it('redirects to expired when token is expired', async () => {
    mockGetServerSupabase.mockResolvedValue({
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gt: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          }),
        }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { status: 'expired', expires_at: '2020-01-01T00:00:00Z' },
              error: null,
            }),
          }),
        }),
      }),
    } as never);

    const req = createMockRequest('http://localhost/email-change/verify?token=expired-token');
    const response = await GET(req);
    const url = new URL(response.headers.get('location') ?? '');
    expect(url.pathname).toBe('/settings/profile');
    expect(url.searchParams.get('email_error')).toBe('expired');
  });

  it('redirects to email-changed when token already claimed (idempotent)', async () => {
    mockGetServerSupabase.mockResolvedValue({
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gt: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          }),
        }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { status: 'verified', expires_at: '2099-01-01T00:00:00Z' },
              error: null,
            }),
          }),
        }),
      }),
    } as never);

    const req = createMockRequest('http://localhost/email-change/verify?token=claimed-token');
    const response = await GET(req);
    const url = new URL(response.headers.get('location') ?? '');
    expect(url.pathname).toBe('/login');
    expect(url.searchParams.get('message')).toBe('email-changed');
  });
});
