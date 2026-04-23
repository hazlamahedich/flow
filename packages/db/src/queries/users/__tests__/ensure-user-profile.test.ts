import { describe, it, expect, vi } from 'vitest';
import { ensureUserProfile } from '../ensure-user-profile';

function createMockClient(upsertResult: Promise<{ error: unknown }>) {
  return {
    from: vi.fn().mockReturnValue({
      upsert: vi.fn().mockReturnValue(upsertResult),
    }),
  } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

describe('ensureUserProfile', () => {
  it('calls upsert with correct payload (id, email, timezone: UTC)', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: vi.fn().mockReturnValue({ upsert: mockUpsert }),
    } as unknown as import('@supabase/supabase-js').SupabaseClient;

    await ensureUserProfile(client, 'user-1', 'test@example.com');

    expect(client.from).toHaveBeenCalledWith('users');
    expect(mockUpsert).toHaveBeenCalledWith(
      { id: 'user-1', email: 'test@example.com', timezone: 'UTC' },
      { onConflict: 'id', ignoreDuplicates: true },
    );
  });

  it('uses onConflict and ignoreDuplicates options', async () => {
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: vi.fn().mockReturnValue({ upsert: mockUpsert }),
    } as never;

    await ensureUserProfile(client, 'user-2', 'a@b.com');

    const [, options] = mockUpsert.mock.calls[0]!;
    expect(options).toEqual({
      onConflict: 'id',
      ignoreDuplicates: true,
    });
  });

  it('does not throw on success', async () => {
    const client = createMockClient(Promise.resolve({ error: null }));

    await expect(
      ensureUserProfile(client, 'user-3', 'ok@test.com'),
    ).resolves.toBeUndefined();
  });

  it('throws with error message on failure', async () => {
    const client = createMockClient(
      Promise.resolve({ error: { message: 'FK violation' } }),
    );

    await expect(
      ensureUserProfile(client, 'user-4', 'fail@test.com'),
    ).rejects.toThrow('Failed to ensure user profile: FK violation');
  });
});
