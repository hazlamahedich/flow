import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@flow/db', () => ({
  createServiceClient: vi.fn(),
}));

import { cleanupRawPayloads } from '../cleanup';
import { createServiceClient } from '@flow/db';

describe('cleanupRawPayloads', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
    };
    (createServiceClient as any).mockReturnValue(mockSupabase);
  });

  it('deletes processed payloads older than TTL', async () => {
    mockSupabase.lt.mockResolvedValueOnce({ count: 42, error: null });

    const result = await cleanupRawPayloads(7);

    expect(result).toBe(42);
    expect(mockSupabase.from).toHaveBeenCalledWith('raw_pubsub_payloads');
    expect(mockSupabase.eq).toHaveBeenCalledWith('processed', true);
    expect(mockSupabase.lt).toHaveBeenCalled();
  });

  it('returns 0 when count is null', async () => {
    mockSupabase.lt.mockResolvedValueOnce({ count: null, error: null });

    const result = await cleanupRawPayloads(7);

    expect(result).toBe(0);
  });

  it('throws when supabase returns error', async () => {
    mockSupabase.lt.mockResolvedValueOnce({ count: null, error: new Error('DB error') });

    await expect(cleanupRawPayloads(7)).rejects.toThrow('DB error');
  });

  it('uses default TTL of 7 days', async () => {
    mockSupabase.lt.mockResolvedValueOnce({ count: 0, error: null });

    await cleanupRawPayloads();

    expect(mockSupabase.lt).toHaveBeenCalledWith('created_at', expect.any(String));
  });
});
