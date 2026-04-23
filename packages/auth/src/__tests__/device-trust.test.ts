import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  hashDeviceToken,
  generateDeviceToken,
  parseUserAgent,
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

describe('hashDeviceToken', () => {
  it('[P0] produces consistent SHA-256 hex digest', () => {
    const hash1 = hashDeviceToken('test-token');
    const hash2 = hashDeviceToken('test-token');
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it('[P0] produces different hashes for different tokens', () => {
    expect(hashDeviceToken('a')).not.toBe(hashDeviceToken('b'));
  });
});

describe('generateDeviceToken', () => {
  it('[P0] generates unique UUID-format tokens', () => {
    const token1 = generateDeviceToken();
    const token2 = generateDeviceToken();
    expect(token1).not.toBe(token2);
    expect(token1).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('parseUserAgent', () => {
  it('[P0] identifies Chrome on macOS', () => {
    expect(parseUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0 Safari/537.36'))
      .toMatch(/Chrome 120 on macOS/);
  });

  it('[P0] identifies Firefox on Windows', () => {
    expect(parseUserAgent('Mozilla/5.0 (Windows NT 10.0; Firefox/119.0'))
      .toMatch(/Firefox 119 on Windows/);
  });

  it('[P0] identifies Safari on iPhone', () => {
    expect(parseUserAgent('Mozilla/5.0 (iPhone; Safari/604.1 Version/17.0'))
      .toBe('Safari on iPhone');
  });

  it('[P0] identifies Edge on macOS', () => {
    expect(parseUserAgent('Mozilla/5.0 (Macintosh; Edg/120.0'))
      .toMatch(/Edge 120 on macOS/);
  });

  it('[P0] returns Unknown Device for null', () => {
    expect(parseUserAgent(null)).toBe('Unknown Device');
  });

  it('[P0] returns Unknown Device for unrecognized UA', () => {
    expect(parseUserAgent('SomeBot/1.0')).toBe('Unknown Device');
  });
});

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

    const result = await trustDevice({ userId: 'user-1', userAgent: 'Chrome/120' });
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

    const result = await trustDevice({ userId: 'user-1', userAgent: 'Chrome/120' });
    if (result.trusted) {
      expect(result.deviceToken).toBeDefined();
      expect(result.deviceId).toBe('dev-new');
    } else {
      expect.unreachable('Expected trusted result');
    }
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

    const result = await verifyDeviceTrust({ userId: 'user-1', deviceCookie: 'token' });
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

    const result = await verifyDeviceTrust({ userId: 'user-1', deviceCookie: 'token' });
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

    const result = await revokeDevice({ userId: 'user-1', deviceId: 'dev-1' });
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

    const count = await revokeAllDevices('user-1');
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
      renameDevice({ userId: 'user-1', deviceId: 'dev-1', label: 'My Laptop' }),
    ).resolves.toBeUndefined();
  });
});

describe('getUserDevices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabase() as Record<string, ReturnType<typeof vi.fn>>;
  });

  it('[P0] maps database rows to DeviceRecord shape', async () => {
    mockSupabase.from!.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [{
              id: 'dev-1',
              user_id: 'user-1',
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

    const devices = await getUserDevices('user-1');
    expect(devices).toHaveLength(1);
    expect(devices[0]).toEqual({
      id: 'dev-1',
      userId: 'user-1',
      deviceTokenHash: 'abc',
      label: 'Chrome on macOS',
      userAgentHint: null,
      lastSeenAt: '2024-01-01T00:00:00Z',
      createdAt: '2024-01-01T00:00:00Z',
      isRevoked: false,
    });
  });
});
