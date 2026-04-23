import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  trustDevice,
  verifyDeviceTrust,
  revokeDevice,
  revokeAllDevices,
  renameDevice,
  getUserDevices,
} from '../device-trust';
import { MAX_TRUSTED_DEVICES } from '../device-types';

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
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  } as unknown as Record<string, ReturnType<typeof vi.fn>>;
}

describe('trustDevice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase() as Record<string, ReturnType<typeof vi.fn>>;
  });

  it('[P0] rejects when device count exceeds max', async () => {
    const devices = Array.from({ length: MAX_TRUSTED_DEVICES }, (_, i) => ({ id: `dev-${i}` }));
    mockSupabase.from!.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: devices, error: null }),
        }),
      }),
    });

    const result = await trustDevice({ userId: crypto.randomUUID(), userAgent: 'Chrome/120' });
    expect(result).toEqual({
      trusted: false,
      reason: 'count_exceeded',
      currentCount: MAX_TRUSTED_DEVICES,
      maxDevices: MAX_TRUSTED_DEVICES,
    });
  });

  it('[P0] returns trusted with token on success', async () => {
    mockSupabase.from!.mockImplementation((table: string) => {
      if (table === 'user_devices') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValueOnce({ data: [], error: null })
                .mockResolvedValueOnce({ data: [], error: null }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: 'dev-new' }, error: null }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    const result = await trustDevice({ userId: crypto.randomUUID(), userAgent: 'Chrome/120' });
    expect(result.trusted).toBe(true);
    expect(result.trusted === true && result.deviceToken).toBeDefined();
    expect(result.trusted === true && result.deviceId).toBe('dev-new');
  });
});

describe('verifyDeviceTrust', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase() as Record<string, ReturnType<typeof vi.fn>>;
  });

  it('[P0] returns trusted for valid non-revoked device', async () => {
    mockSupabase.from!.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'dev-1', is_revoked: false },
              error: null,
            }),
          }),
        }),
      }),
    });

    const result = await verifyDeviceTrust({ userId: crypto.randomUUID(), deviceCookie: 'token' });
    expect(result).toEqual({ trusted: true, deviceId: 'dev-1' });
  });

  it('[P0] returns not trusted for revoked device', async () => {
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

    const result = await verifyDeviceTrust({ userId: crypto.randomUUID(), deviceCookie: 'token' });
    expect(result.trusted).toBe(false);
  });
});

describe('revokeDevice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase() as Record<string, ReturnType<typeof vi.fn>>;
  });

  it('[P0] returns revoked on success', async () => {
    mockSupabase.from!.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { id: 'dev-1' }, error: null }),
              }),
            }),
          }),
        }),
      }),
    });

    const result = await revokeDevice({ userId: crypto.randomUUID(), deviceId: 'dev-1' });
    expect(result).toEqual({ revoked: true, deviceId: 'dev-1' });
  });
});

describe('revokeAllDevices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase() as Record<string, ReturnType<typeof vi.fn>>;
  });

  it('[P0] returns count of revoked devices', async () => {
    mockSupabase.from!.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: [{ id: 'dev-1' }, { id: 'dev-2' }],
              error: null,
            }),
          }),
        }),
      }),
    });

    const count = await revokeAllDevices(crypto.randomUUID());
    expect(count).toBe(2);
  });
});

describe('renameDevice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase() as Record<string, ReturnType<typeof vi.fn>>;
  });

  it('[P0] completes without error on success', async () => {
    mockSupabase.from!.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    });

    await expect(
      renameDevice({ userId: crypto.randomUUID(), deviceId: 'dev-1', label: 'My Laptop' }),
    ).resolves.toBeUndefined();
  });
});

describe('getUserDevices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase() as Record<string, ReturnType<typeof vi.fn>>;
  });

  it('[P0] maps database rows to DeviceRecord shape', async () => {
    const userId = crypto.randomUUID();
    mockSupabase.from!.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [{
              id: 'dev-1',
              user_id: userId,
              device_token_hash: 'abc',
              label: 'Chrome on macOS',
              user_agent_hint: null,
              last_seen_at: '2024-01-01T00:00:00Z',
              created_at: '2024-01-01T00:00:00Z',
              is_revoked: false,
            }],
            error: null,
          }),
        }),
      }),
    });

    const devices = await getUserDevices(userId);
    expect(devices).toHaveLength(1);
    expect(devices[0]).toEqual({
      id: 'dev-1',
      userId,
      deviceTokenHash: 'abc',
      label: 'Chrome on macOS',
      userAgentHint: null,
      lastSeenAt: '2024-01-01T00:00:00Z',
      createdAt: '2024-01-01T00:00:00Z',
      isRevoked: false,
    });
  });
});
