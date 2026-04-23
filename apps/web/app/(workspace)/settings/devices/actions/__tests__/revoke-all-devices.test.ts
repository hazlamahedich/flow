import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('@/lib/auth-audit', () => ({
  logAuthEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn((key: string) => {
      if (key === 'x-forwarded-for') return '127.0.0.1';
      return null;
    }),
  }),
}));

vi.mock('@flow/auth/device-trust', () => ({
  revokeAllDevices: vi.fn(),
}));

vi.mock('@flow/auth/server-admin', () => ({
  invalidateUserSessions: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@flow/db', () => ({
  createFlowError: (status: number, code: string, message: string) =>
    Object.assign(new Error(message), { status, code }),
}));

import { revokeAllDevicesAction } from '../revoke-all-devices';
import { getServerSupabase } from '@/lib/supabase-server';
import { revokeAllDevices } from '@flow/auth/device-trust';
import { invalidateUserSessions } from '@flow/auth/server-admin';

type MockSupabase = Awaited<ReturnType<typeof getServerSupabase>>;

describe('revokeAllDevicesAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('[P0] returns auth error when no session', async () => {
    vi.mocked(getServerSupabase).mockResolvedValue({
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
    } as unknown as MockSupabase);

    const result = await revokeAllDevicesAction();
    expect(result.success).toBe(false);
  });

  it('[P0] revokes all devices and invalidates sessions', async () => {
    vi.mocked(getServerSupabase).mockResolvedValue({
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } }) },
    } as unknown as MockSupabase);
    vi.mocked(revokeAllDevices).mockResolvedValue(3);

    const result = await revokeAllDevicesAction();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.revokedCount).toBe(3);
    }
    expect(invalidateUserSessions).toHaveBeenCalledWith('user-1');
  });

  it('[P0] returns success even when session invalidation fails', async () => {
    vi.mocked(getServerSupabase).mockResolvedValue({
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } }) },
    } as unknown as MockSupabase);
    vi.mocked(revokeAllDevices).mockResolvedValue(2);
    vi.mocked(invalidateUserSessions).mockRejectedValue(new Error('timeout'));

    const result = await revokeAllDevicesAction();
    expect(result.success).toBe(true);
  });

  it('[P0] returns error when revokeAllDevices throws', async () => {
    vi.mocked(getServerSupabase).mockResolvedValue({
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } }) },
    } as unknown as MockSupabase);
    vi.mocked(revokeAllDevices).mockRejectedValue(new Error('db error'));

    const result = await revokeAllDevicesAction();
    expect(result.success).toBe(false);
  });
});
