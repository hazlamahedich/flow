import { describe, it, expect, vi } from 'vitest';
import { listUserWorkspaces } from './list-user-workspaces';

function mockClient(data: unknown[] | null, error: object | null) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
  };
  let callCount = 0;
  Object.defineProperty(builder, 'then', {
    get: () => {
      callCount++;
      if (callCount > 1) return undefined;
      return (resolve: (v: { data: unknown; error: object | null }) => void) =>
        resolve({ data, error });
    },
  });
  return { from: vi.fn(() => builder) } as unknown as Parameters<typeof listUserWorkspaces>[0];
}

describe('listUserWorkspaces', () => {
  const userId = '00000000-0000-0000-0000-000000000001';

  it('returns workspaces for valid user', async () => {
    const client = mockClient(
      [
        { workspace_id: 'ws-1', role: 'owner', workspaces: { name: 'Acme' } },
        { workspace_id: 'ws-2', role: 'member', workspaces: { name: 'Beta' } },
      ],
      null,
    );

    const result = await listUserWorkspaces(client, userId);

    expect(result).toEqual([
      { id: 'ws-1', name: 'Acme', role: 'owner' },
      { id: 'ws-2', name: 'Beta', role: 'member' },
    ]);
  });

  it('returns empty for user with no workspaces', async () => {
    const client = mockClient([], null);

    const result = await listUserWorkspaces(client, userId);

    expect(result).toEqual([]);
  });

  it('throws on non-42P01 Supabase error', async () => {
    const client = mockClient(null, { message: 'connection failed', code: '08000' });

    await expect(listUserWorkspaces(client, userId)).rejects.toThrow();
  });

  it('returns empty on 42P01 (missing table)', async () => {
    const client = mockClient(null, { message: 'undefined_object', code: '42P01' });

    const result = await listUserWorkspaces(client, userId);

    expect(result).toEqual([]);
  });
});
