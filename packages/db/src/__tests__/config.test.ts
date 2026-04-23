import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getConfig } from '../config';

vi.mock('../client', () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from '../client';

function createChainMock(result: Promise<{ data: unknown; error: unknown }>) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnValue(result),
  };
  return {
    from: vi.fn().mockReturnValue(chain),
  };
}

describe('getConfig', () => {
  const cookieStore = {
    getAll: vi.fn(),
    set: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns parsed config value on success', async () => {
    const chain = createChainMock(
      Promise.resolve({ data: { value: '{"theme":"dark"}' }, error: null }),
    );
    vi.mocked(createServerClient).mockReturnValue(chain as never);

    const parser = vi.fn((v: unknown) => JSON.parse(v as string));
    const result = await getConfig('ui.theme', parser, cookieStore);

    expect(result).toEqual({ theme: 'dark' });
    expect(parser).toHaveBeenCalledWith('{"theme":"dark"}');
  });

  it('throws with key name when config not found', async () => {
    const chain = createChainMock(
      Promise.resolve({ data: null, error: { message: 'No rows' } }),
    );
    vi.mocked(createServerClient).mockReturnValue(chain as never);

    await expect(
      getConfig('missing.key', (v) => v, cookieStore),
    ).rejects.toThrow('Config key "missing.key" not found: No rows');
  });

  it('throws with parser error when value invalid', async () => {
    const chain = createChainMock(
      Promise.resolve({ data: { value: 'not-json' }, error: null }),
    );
    vi.mocked(createServerClient).mockReturnValue(chain as never);

    await expect(
      getConfig('bad.key', (v) => JSON.parse(v as string), cookieStore),
    ).rejects.toThrow(/Config key "bad\.key" has invalid value/);
  });

  it('passes cookieStore to createServerClient', async () => {
    const chain = createChainMock(
      Promise.resolve({ data: { value: '42' }, error: null }),
    );
    vi.mocked(createServerClient).mockReturnValue(chain as never);

    await getConfig('some.key', (v) => Number(v), cookieStore);

    expect(createServerClient).toHaveBeenCalledWith(cookieStore);
  });
});
