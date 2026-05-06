import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveMorningBrief } from '../briefs';
import { createServiceClient } from '../../../client';
import { insertSignal } from '../../agents/signals';

vi.mock('../../../client', () => ({
  createServiceClient: vi.fn(),
}));

vi.mock('../../agents/signals', () => ({
  insertSignal: vi.fn().mockResolvedValue({}),
}));

describe('brief-queries', () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createServiceClient as any).mockReturnValue(mockSupabase);
  });

  const workspace_id = '550e8400-e29b-41d4-a716-446655440001';
  const validBrief = {
    workspace_id,
    brief_date: '2026-05-05',
    content: {
      summaryLine: 'Test',
      handledItems: [] as unknown[],
      needsAttentionItems: [] as unknown[],
      threadSummaries: [] as unknown[],
      clientBreakdown: [] as unknown[],
    },
    email_count_handled: 0,
    email_count_attention: 0,
    generation_status: 'completed' as const,
  };

  it('upserts a brief and emits a success signal', async () => {
    mockSupabase.single.mockResolvedValueOnce({
      data: {
        ...validBrief,
        workspace_id,
        id: 'brief-1',
        generated_at: new Date().toISOString(),
      },
      error: null,
    });

    await saveMorningBrief(validBrief);

    expect(mockSupabase.from).toHaveBeenCalledWith('morning_briefs');
    expect(mockSupabase.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ ...validBrief, generated_at: expect.any(String) }),
      { onConflict: 'workspace_id, brief_date' },
    );
    expect(insertSignal).toHaveBeenCalledWith(expect.objectContaining({
      signalType: 'morning_brief.generated',
    }));
  });

  it('emits a failure signal when upsert fails', async () => {
    mockSupabase.single.mockResolvedValueOnce({ data: null, error: new Error('DB Error') });

    await expect(saveMorningBrief(validBrief)).rejects.toThrow('DB Error');

    expect(insertSignal).toHaveBeenCalledWith(expect.objectContaining({
      signalType: 'morning_brief.generation_failed',
    }));
  });
});
