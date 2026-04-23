import { describe, it, expect, vi, beforeEach } from 'vitest';
import { trustDevice, verifyDeviceTrust } from '@flow/auth';
import { MAX_TRUSTED_DEVICES } from '@flow/auth';

vi.mock('@flow/db/client', () => ({
  createServiceClient: vi.fn(() => mockSupabase),
}));

vi.mock('@flow/db', () => ({
  createFlowError: (status: number, code: string, message: string) => {
    const err = new Error(message);
    return Object.assign(err, { status, code });
  },
}));

let mockSupabase: Record<string, ReturnType<typeof vi.fn>>;

function createMockSupabase() {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'dev-new' }, error: null }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  } as unknown as Record<string, ReturnType<typeof vi.fn>>;
}

describe('device trust concurrency safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase() as Record<string, ReturnType<typeof vi.fn>>;
  });

  it('trustDevice rejects when MAX_TRUSTED_DEVICES already active', async () => {
    const existingDevices = Array.from({ length: MAX_TRUSTED_DEVICES }, (_, i) => ({ id: `dev-${i}` }));

    mockSupabase.from!.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: existingDevices, error: null }),
        }),
      }),
    });

    const result = await trustDevice({ userId: crypto.randomUUID(), userAgent: 'Chrome/120' });

    expect(result.trusted).toBe(false);
    if (!result.trusted) {
      expect(result.reason).toBe('count_exceeded');
      expect(result.currentCount).toBe(MAX_TRUSTED_DEVICES);
      expect(result.maxDevices).toBe(MAX_TRUSTED_DEVICES);
    }
  });

  it('trustDevice rolls back insert when post-insert count exceeds MAX', async () => {
    const deleteFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    let callCount = 0;
    mockSupabase.from!.mockImplementation((table: string) => {
      if (table === 'user_devices') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                  return Promise.resolve({ data: [{ id: 'existing-1' }], error: null });
                }
                return Promise.resolve({
                  data: Array.from({ length: MAX_TRUSTED_DEVICES + 1 }, (_, i) => ({ id: `dev-${i}` })),
                  error: null,
                });
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'dev-new' }, error: null }),
            }),
          }),
          delete: deleteFn,
        };
      }
      return { select: vi.fn() };
    });

    const result = await trustDevice({ userId: crypto.randomUUID(), userAgent: 'Chrome/120' });

    expect(result.trusted).toBe(false);
    if (!result.trusted) {
      expect(result.reason).toBe('count_exceeded');
    }
    expect(deleteFn).toHaveBeenCalled();
  });

  it('verifyDeviceTrust returns not trusted for revoked device', async () => {
    mockSupabase.from!.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'dev-1', is_revoked: true },
              error: null,
            }),
          }),
        }),
      }),
    });

    const result = await verifyDeviceTrust({
      userId: crypto.randomUUID(),
      deviceCookie: 'some-token',
    });
    expect(result.trusted).toBe(false);
  });

  it('verifyDeviceTrust returns not trusted for missing device', async () => {
    mockSupabase.from!.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'No rows' },
            }),
          }),
        }),
      }),
    });

    const result = await verifyDeviceTrust({
      userId: crypto.randomUUID(),
      deviceCookie: 'unknown-token',
    });
    expect(result.trusted).toBe(false);
  });

  it('trustDevice retries on unique constraint violation (23505)', async () => {
    const insertFn = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn()
          .mockResolvedValueOnce({ data: null, error: { code: '23505', message: 'duplicate' } })
          .mockResolvedValueOnce({ data: { id: 'dev-new' }, error: null }),
      }),
    });

    mockSupabase.from!.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
      insert: insertFn,
      delete: vi.fn().mockResolvedValue({ error: null }),
    }));

    const result = await trustDevice({ userId: crypto.randomUUID(), userAgent: 'Chrome/120' });

    expect(result.trusted).toBe(true);
    if (result.trusted) {
      expect(result.deviceToken).toBeDefined();
    }
  });
});
