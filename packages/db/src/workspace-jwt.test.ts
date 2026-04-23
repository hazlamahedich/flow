import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActiveWorkspace } from './workspace-jwt';

vi.mock('./client', () => ({
  createServiceClient: vi.fn(),
}));

import { createServiceClient } from './client';

describe('setActiveWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('[P0] throws for invalid userId', async () => {
    await expect(
      setActiveWorkspace('not-uuid', '550e8400-e29b-41d4-a716-446655440000'),
    ).rejects.toThrow('Invalid userId');
  });

  it('[P0] throws for invalid workspaceId', async () => {
    await expect(
      setActiveWorkspace('550e8400-e29b-41d4-a716-446655440000', 'not-uuid'),
    ).rejects.toThrow('Invalid workspaceId');
  });

  it('[P0] updates app_metadata with workspace_id', async () => {
    const mockUpdateUserById = vi.fn().mockResolvedValue({ error: null });
    const mockGetUserById = vi.fn().mockResolvedValue({
      data: { user: { app_metadata: { foo: 'bar' } } },
    });

    vi.mocked(createServiceClient).mockReturnValue({
      auth: {
        admin: {
          getUserById: mockGetUserById,
          updateUserById: mockUpdateUserById,
        },
      },
    } as unknown as ReturnType<typeof createServiceClient>);

    await setActiveWorkspace('550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440001');

    expect(mockUpdateUserById).toHaveBeenCalledWith(
      '550e8400-e29b-41d4-a716-446655440000',
      expect.objectContaining({
        app_metadata: expect.objectContaining({
          workspace_id: '660e8400-e29b-41d4-a716-446655440001',
        }),
      }),
    );
  });

  it('[P0] throws when getUserById fails', async () => {
    vi.mocked(createServiceClient).mockReturnValue({
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
          updateUserById: vi.fn(),
        },
      },
    } as unknown as ReturnType<typeof createServiceClient>);

    await expect(
      setActiveWorkspace('550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440001'),
    ).rejects.toThrow('Failed to fetch user');
  });

  it('[P0] throws when updateUserById fails', async () => {
    vi.mocked(createServiceClient).mockReturnValue({
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({ data: { user: { app_metadata: {} } } }),
          updateUserById: vi.fn().mockResolvedValue({ error: { message: 'update failed' } }),
        },
      },
    } as unknown as ReturnType<typeof createServiceClient>);

    await expect(
      setActiveWorkspace('550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440001'),
    ).rejects.toThrow('Failed to set active workspace');
  });
});
