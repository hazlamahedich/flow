import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isFloodState } from '../flood';
import { createServiceClient } from '@flow/db';

vi.mock('@flow/db', () => ({
  createServiceClient: vi.fn(),
}));

describe('isFloodState', () => {
  const workspaceId = 'ws-123';
  const mockSupabase: any = {
    from: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    gte: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createServiceClient as any).mockReturnValue(mockSupabase);
    mockSupabase.from.mockImplementation(() => mockSupabase);
    mockSupabase.select.mockImplementation(() => mockSupabase);
    mockSupabase.eq.mockImplementation(() => mockSupabase);
    mockSupabase.in.mockImplementation(() => mockSupabase);
    mockSupabase.gte.mockImplementation(() => mockSupabase);
  });

  it('returns false when email count is exactly at threshold (31)', async () => {
    mockSupabase.gte.mockResolvedValueOnce({ count: 31, error: null });

    const result = await isFloodState(workspaceId);
    expect(result).toBe(false);
  });

  it('returns true when email count is strictly above threshold (32)', async () => {
    mockSupabase.gte.mockResolvedValueOnce({ count: 32, error: null });

    const result = await isFloodState(workspaceId);
    expect(result).toBe(true);
    expect(mockSupabase.from).toHaveBeenCalledWith('emails');
    expect(mockSupabase.in).toHaveBeenCalledWith('category', ['urgent', 'action']);
  });

  it('returns true when email count is well above threshold', async () => {
    mockSupabase.gte.mockResolvedValueOnce({ count: 50, error: null });

    const result = await isFloodState(workspaceId);
    expect(result).toBe(true);
  });

  it('returns false when email count is below threshold', async () => {
    mockSupabase.gte.mockResolvedValueOnce({ count: 30, error: null });

    const result = await isFloodState(workspaceId);
    expect(result).toBe(false);
  });

  it('throws when supabase returns error', async () => {
    mockSupabase.gte.mockResolvedValueOnce({ count: null, error: new Error('DB Error') });

    await expect(isFloodState(workspaceId)).rejects.toThrow('DB Error');
  });
});
