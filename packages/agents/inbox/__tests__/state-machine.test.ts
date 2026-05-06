import { describe, it, expect, vi, beforeEach } from 'vitest';
import { transitionState, getProcessingState, InvalidStateTransitionError } from '../state-machine';
import { createServiceClient } from '@flow/db';

vi.mock('@flow/db', () => ({
  createServiceClient: vi.fn(),
}));

describe('state-machine', () => {
  const emailId = 'e1111111-1111-1111-1111-111111111111';
  const workspaceId = 'w1111111-1111-1111-1111-111111111111';
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
      upsert: vi.fn(),
    };
    (createServiceClient as any).mockReturnValue(mockSupabase);
  });

  it('should allow valid transition from categorized to extraction_pending', async () => {
    mockSupabase.maybeSingle.mockResolvedValue({ data: { state: 'categorized' }, error: null });
    mockSupabase.upsert.mockResolvedValue({ error: null });

    await transitionState(emailId, workspaceId, 'extraction_pending');

    expect(mockSupabase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'extraction_pending' }),
      expect.anything()
    );
  });

  it('should throw error for invalid transition (categorized -> draft_complete)', async () => {
    mockSupabase.maybeSingle.mockResolvedValue({ data: { state: 'categorized' }, error: null });

    await expect(transitionState(emailId, workspaceId, 'draft_complete')).rejects.toThrow(
      InvalidStateTransitionError
    );
  });

  it('should allow extraction_complete -> draft_pending', async () => {
    mockSupabase.maybeSingle.mockResolvedValue({ data: { state: 'extraction_complete' }, error: null });
    mockSupabase.upsert.mockResolvedValue({ error: null });

    await transitionState(emailId, workspaceId, 'draft_pending');

    expect(mockSupabase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'draft_pending' }),
      expect.anything()
    );
  });

  it('should allow extraction_complete -> draft_deferred', async () => {
    mockSupabase.maybeSingle.mockResolvedValue({ data: { state: 'extraction_complete' }, error: null });
    mockSupabase.upsert.mockResolvedValue({ error: null });

    await transitionState(emailId, workspaceId, 'draft_deferred');

    expect(mockSupabase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'draft_deferred' }),
      expect.anything()
    );
  });

  it('should default to categorized if no record exists', async () => {
    mockSupabase.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockSupabase.upsert.mockResolvedValue({ error: null });

    await transitionState(emailId, workspaceId, 'extraction_pending');

    expect(mockSupabase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'extraction_pending' }),
      expect.anything()
    );
  });

  it('should return null if no processing state exists', async () => {
    mockSupabase.maybeSingle.mockResolvedValue({ data: null, error: null });

    const state = await getProcessingState(emailId, workspaceId);

    expect(state).toBeNull();
  });

  it('should return the current processing state', async () => {
    mockSupabase.maybeSingle.mockResolvedValue({ data: { state: 'extraction_complete' }, error: null });

    const state = await getProcessingState(emailId, workspaceId);

    expect(state).toBe('extraction_complete');
  });
});
