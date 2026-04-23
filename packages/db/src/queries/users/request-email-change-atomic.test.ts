import { describe, it, expect, vi } from 'vitest';
import { requestEmailChangeAtomic } from './request-email-change-atomic';

function mockClient(rpcResult: { data?: unknown; error?: unknown }) {
  return {
    rpc: vi.fn().mockResolvedValue(rpcResult),
  } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

describe('requestEmailChangeAtomic', () => {
  it('[P0] returns allowed=true when request count under limit', async () => {
    const client = mockClient({
      data: { request_count: 2, was_inserted: 1, pending_new_email: null },
    });

    const result = await requestEmailChangeAtomic(client, 'user-1', 'new@test.com', 'tok');
    expect(result.allowed).toBe(true);
    expect(result.wasInserted).toBe(true);
    expect(result.pendingExists).toBe(false);
  });

  it('[P0] returns allowed=false when request count at limit', async () => {
    const client = mockClient({
      data: { request_count: 5, was_inserted: 0, pending_new_email: 'old@test.com' },
    });

    const result = await requestEmailChangeAtomic(client, 'user-1', 'new@test.com', 'tok');
    expect(result.allowed).toBe(false);
    expect(result.wasInserted).toBe(false);
    expect(result.pendingExists).toBe(true);
    expect(result.pendingNewEmail).toBe('old@test.com');
  });

  it('[P0] throws on RPC error', async () => {
    const client = mockClient({
      data: null,
      error: { message: 'connection refused' },
    });

    await expect(
      requestEmailChangeAtomic(client, 'user-1', 'new@test.com', 'tok'),
    ).rejects.toThrow('Atomic email change request failed');
  });

  it('[P0] throws on unauthorized error from RPC', async () => {
    const client = mockClient({
      data: { error: 'unauthorized' },
    });

    await expect(
      requestEmailChangeAtomic(client, 'user-1', 'new@test.com', 'tok'),
    ).rejects.toThrow('unauthorized');
  });

  it('[P1] returns pendingExists=true when wasInserted=0 and pending email exists', async () => {
    const client = mockClient({
      data: { request_count: 1, was_inserted: 0, pending_new_email: 'pending@test.com' },
    });

    const result = await requestEmailChangeAtomic(client, 'user-1', 'new@test.com', 'tok');
    expect(result.pendingExists).toBe(true);
    expect(result.pendingNewEmail).toBe('pending@test.com');
  });

  it('[P1] handles missing response fields with defaults', async () => {
    const client = mockClient({ data: {} });

    const result = await requestEmailChangeAtomic(client, 'user-1', 'new@test.com', 'tok');
    expect(result.allowed).toBe(true);
    expect(result.wasInserted).toBe(false);
    expect(result.requestCount).toBe(0);
  });
});
