import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

function createMockClient(updateResult: { error: { message: string } | null }) {
  const eq = vi.fn().mockResolvedValue(updateResult);
  const update = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ update });
  return { from } as unknown as SupabaseClient;
}

describe('syncUserEmail', () => {
  it('updates public.users email to match auth email', async () => {
    const client = createMockClient({ error: null });

    const { syncUserEmail } = await import('../sync-user-email');
    await syncUserEmail(client, 'user-1', 'new@example.com');

    expect(client.from).toHaveBeenCalledWith('users');
  });

  it('throws when database update fails', async () => {
    const client = createMockClient({ error: { message: 'Row not found' } });

    const { syncUserEmail } = await import('../sync-user-email');
    await expect(syncUserEmail(client, 'user-1', 'new@example.com')).rejects.toThrow(
      'Failed to sync user email',
    );
  });

  it('handles split-brain: auth email differs from public.users email', async () => {
    const client = createMockClient({ error: null });

    const { syncUserEmail } = await import('../sync-user-email');
    await syncUserEmail(client, 'user-1', 'auth-layer@example.com');

    expect(client.from).toHaveBeenCalledWith('users');
  });
});
