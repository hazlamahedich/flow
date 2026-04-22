import { describe, it, expect, vi, beforeEach } from 'vitest';

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
import { createServiceClient, syncUserEmail } from '@flow/db';
import { revalidateTag } from 'next/cache';

const mockCreateServiceClient = vi.mocked(createServiceClient);
const mockSyncUserEmail = vi.mocked(syncUserEmail);

function createMockRequest(url: string) {
  return new Request(url) as never;
}

function makeAdminClient(options: {
  claimResult?: { data: unknown; error: unknown };
  selectResult?: { data: unknown; error: unknown };
  signOutResult?: { data: unknown; error: unknown };
}) {
  const fromChain: Record<string, unknown> = {};

  if (options.claimResult) {
    fromChain.update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gt: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue(options.claimResult),
            }),
          }),
        }),
      }),
    });
  }

  if (options.selectResult) {
    fromChain.select = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue(options.selectResult),
      }),
    });
  }

  return {
    from: vi.fn().mockReturnValue(fromChain),
    auth: {
      admin: {
        signOut: vi.fn().mockResolvedValue(
          options.signOutResult ?? { data: {}, error: null },
        ),
      },
    },
  } as never;
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

  it('redirects to email-changed with email param when claim succeeds', async () => {
    const claimed = { user_id: 'user-1', new_email: 'new@test.com' };

    mockCreateServiceClient.mockReturnValue(
      makeAdminClient({ claimResult: { data: claimed, error: null } }),
    );
    mockSyncUserEmail.mockResolvedValue(undefined);

    const req = createMockRequest('http://localhost/email-change/verify?token=abc-123');
    const response = await GET(req);
    const url = new URL(response.headers.get('location') ?? '');
    expect(url.pathname).toBe('/login');
    expect(url.searchParams.get('message')).toBe('email-changed');
    expect(url.searchParams.get('email')).toBe('new@test.com');
    expect(mockSyncUserEmail).toHaveBeenCalled();
  });

  it('redirects to expired when token is expired', async () => {
    mockCreateServiceClient.mockReturnValue(
      makeAdminClient({
        claimResult: { data: null, error: null },
        selectResult: {
          data: { status: 'expired', expires_at: '2020-01-01T00:00:00Z' },
          error: null,
        },
      }),
    );

    const req = createMockRequest('http://localhost/email-change/verify?token=expired-token');
    const response = await GET(req);
    const url = new URL(response.headers.get('location') ?? '');
    expect(url.pathname).toBe('/settings/profile');
    expect(url.searchParams.get('email_error')).toBe('expired');
  });

  it('redirects to email-changed when token already claimed (idempotent)', async () => {
    mockCreateServiceClient.mockReturnValue(
      makeAdminClient({
        claimResult: { data: null, error: null },
        selectResult: {
          data: { status: 'verified', expires_at: '2099-01-01T00:00:00Z' },
          error: null,
        },
      }),
    );

    const req = createMockRequest('http://localhost/email-change/verify?token=claimed-token');
    const response = await GET(req);
    const url = new URL(response.headers.get('location') ?? '');
    expect(url.pathname).toBe('/login');
    expect(url.searchParams.get('message')).toBe('email-changed');
  });

  it('redirects to sync-failed when claim throws DB error', async () => {
    mockCreateServiceClient.mockReturnValue(
      makeAdminClient({ claimResult: { data: null, error: { message: 'DB error' } } }),
    );

    const req = createMockRequest('http://localhost/email-change/verify?token=abc-123');
    const response = await GET(req);
    const url = new URL(response.headers.get('location') ?? '');
    expect(url.searchParams.get('email_error')).toBe('sync-failed');
  });

  it('redirects to sync-failed when syncUserEmail throws', async () => {
    const claimed = { user_id: 'user-1', new_email: 'new@test.com' };

    mockCreateServiceClient.mockReturnValue(
      makeAdminClient({ claimResult: { data: claimed, error: null } }),
    );
    mockSyncUserEmail.mockRejectedValue(new Error('sync failed'));

    const req = createMockRequest('http://localhost/email-change/verify?token=abc-123');
    const response = await GET(req);
    const url = new URL(response.headers.get('location') ?? '');
    expect(url.searchParams.get('email_error')).toBe('sync-failed');
  });
});
