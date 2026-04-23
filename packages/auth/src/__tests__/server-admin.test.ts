import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invalidateUserSessions } from '../server-admin';

vi.mock('@flow/db/client', () => ({
  createServiceClient: vi.fn(),
}));

vi.mock('@flow/db', () => ({
  createFlowError: (status: number, code: string, message: string) => {
    const err = new Error(message);
    return Object.assign(err, { status, code });
  },
}));

import { createServiceClient } from '@flow/db/client';

describe('invalidateUserSessions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('[P0] throws validation error for non-UUID user ID', async () => {
    await expect(invalidateUserSessions('not-a-uuid')).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
    });
  });

  it('[P0] calls admin.signOut with valid UUID', async () => {
    const mockSignOut = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createServiceClient).mockReturnValue({
      auth: { admin: { signOut: mockSignOut } },
    } as unknown as ReturnType<typeof createServiceClient>);

    await invalidateUserSessions('550e8400-e29b-41d4-a716-446655440000');
    expect(mockSignOut).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000');
  });

  it('[P0] throws internal error when signOut fails', async () => {
    const mockSignOut = vi.fn().mockResolvedValue({
      error: { message: 'Network error' },
    });
    vi.mocked(createServiceClient).mockReturnValue({
      auth: { admin: { signOut: mockSignOut } },
    } as unknown as ReturnType<typeof createServiceClient>);

    await expect(
      invalidateUserSessions('550e8400-e29b-41d4-a716-446655440000'),
    ).rejects.toMatchObject({
      status: 500,
      code: 'INTERNAL_ERROR',
    });
  });

  it('[P1] accepts uppercase UUID', async () => {
    const mockSignOut = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createServiceClient).mockReturnValue({
      auth: { admin: { signOut: mockSignOut } },
    } as unknown as ReturnType<typeof createServiceClient>);

    await invalidateUserSessions('550E8400-E29B-41D4-A716-446655440000');
    expect(mockSignOut).toHaveBeenCalled();
  });
});
