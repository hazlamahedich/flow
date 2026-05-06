import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleRecategorization } from '../recategorize';
import { createServiceClient } from '@flow/db';
import { transitionState } from '../state-machine';
import { recordRecategorizationMetric } from '../trust';
import { PgBossProducer } from '../../orchestrator/pg-boss-producer.js';

vi.mock('@flow/db', () => ({
  createServiceClient: vi.fn(),
}));

vi.mock('../state-machine', () => ({
  transitionState: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../trust', () => ({
  recordRecategorizationMetric: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../orchestrator/pg-boss-producer.js', () => ({
  PgBossProducer: vi.fn().mockImplementation(() => ({
    submit: vi.fn().mockResolvedValue(undefined),
  })),
}));

describe('recategorize', () => {
  let mockSupabase: any;
  const emailId = 'e1111111-1111-1111-1111-111111111111';
  const workspaceId = 'w1111111-1111-1111-1111-111111111111';
  const clientInboxId = 'i1111111-1111-1111-1111-111111111111';
  const userId = 'u1111111-1111-1111-1111-111111111111';

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Define the query chain helper
    const createChain = () => {
      const chain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(),
        maybeSingle: vi.fn(),
        update: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue({ error: null }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
      };
      return chain;
    };

    mockSupabase = {
      from: vi.fn().mockImplementation(() => createChain()),
    };
    (createServiceClient as any).mockReturnValue(mockSupabase);
  });

  it('should handle actionable -> non-actionable transition (AC7)', async () => {
    const chain = mockSupabase.from();
    mockSupabase.from.mockReturnValue(chain);

    // Mock loading email info
    chain.single.mockResolvedValue({
      data: { client_inbox_id: clientInboxId },
      error: null,
    });
    
    // Mock update results
    chain.update.mockReturnThis();
    chain.eq.mockReturnThis();

    await handleRecategorization(
      emailId,
      workspaceId,
      'urgent', // Old
      'info',   // New
      userId
    );

    // Verify logging
    expect(mockSupabase.from).toHaveBeenCalledWith('recategorization_log');
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        old_category: 'urgent',
        new_category: 'info',
        client_inbox_id: clientInboxId,
      })
    );

    // Verify cascade: soft-delete extractions
    expect(mockSupabase.from).toHaveBeenCalledWith('extracted_actions');
    expect(chain.update).toHaveBeenCalledWith({ soft_deleted: true });
    expect(chain.eq).toHaveBeenCalledWith('email_id', emailId);

    // Verify cascade: cancel drafts
    expect(mockSupabase.from).toHaveBeenCalledWith('draft_responses');
    expect(chain.update).toHaveBeenCalledWith({ status: 'superseded' });

    // Verify state transition
    expect(transitionState).toHaveBeenCalledWith(emailId, workspaceId, 'extraction_skipped');
    
    // Verify trust metric update
    expect(recordRecategorizationMetric).toHaveBeenCalledWith(workspaceId, clientInboxId);
  });

  it('should handle non-actionable -> actionable transition (AC7)', async () => {
    const chain = mockSupabase.from();
    mockSupabase.from.mockReturnValue(chain);

    chain.single.mockResolvedValue({
      data: { client_inbox_id: clientInboxId },
      error: null,
    });
    
    const mockBoss = {};

    await handleRecategorization(
      emailId,
      workspaceId,
      'noise',  // Old
      'action', // New
      userId,
      mockBoss as any
    );

    // Verify extraction job enqueue
    expect(PgBossProducer).toHaveBeenCalled();
    expect(transitionState).toHaveBeenCalledWith(emailId, workspaceId, 'extraction_pending');
  });

  it('should throw if boss is missing during non-actionable -> actionable transition', async () => {
    const chain = mockSupabase.from();
    mockSupabase.from.mockReturnValue(chain);

    chain.single.mockResolvedValue({
      data: { client_inbox_id: clientInboxId },
      error: null,
    });

    await expect(
      handleRecategorization(emailId, workspaceId, 'info', 'urgent', userId)
    ).rejects.toThrow('PgBoss unavailable');
  });
});
