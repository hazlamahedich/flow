import { describe, it, expect, vi } from 'vitest';
import { getScopeCreepAlerts } from '../utilization';
import type { SupabaseClient } from '@supabase/supabase-js';

function createRpcClient(rpcResult: { data: unknown; error: unknown }) {
  return {
    rpc: vi.fn().mockResolvedValue(rpcResult),
  } as unknown as SupabaseClient;
}

describe('getScopeCreepAlerts', () => {
  it('returns empty array when RPC returns null data', async () => {
    const client = createRpcClient({ data: null, error: null });
    const result = await getScopeCreepAlerts(client, { workspaceId: 'w1' });
    expect(result).toEqual([]);
  });

  it('returns empty array when RPC returns empty array', async () => {
    const client = createRpcClient({ data: [], error: null });
    const result = await getScopeCreepAlerts(client, { workspaceId: 'w1' });
    expect(result).toEqual([]);
  });

  it('throws error when RPC fails (no fallback)', async () => {
    const client = createRpcClient({
      data: null,
      error: { message: 'function not found' },
    });

    await expect(
      getScopeCreepAlerts(client, { workspaceId: 'w1' }),
    ).rejects.toThrow('[getScopeCreepAlerts] RPC failed');
  });
});
