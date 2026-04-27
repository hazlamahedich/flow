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

  it('delegates to JS fallback when RPC fails', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'function not found' },
      }),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await getScopeCreepAlerts(client, { workspaceId: 'w1' });
    expect(result).toEqual([]);
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('[getScopeCreepAlerts] RPC failed'),
      expect.anything(),
    );
    consoleWarn.mockRestore();
  });
});
