import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execute } from '../executor';
import { createServiceClient } from '@flow/db';
import { PgBossProducer } from '../../orchestrator/pg-boss-producer.js';
import { transitionState } from '../state-machine';

vi.mock('@flow/db', () => ({
  createServiceClient: vi.fn(),
  updateEmailCategorization: vi.fn(),
  insertSignal: vi.fn(),
}));

vi.mock('../../orchestrator/pg-boss-producer.js', () => ({
  PgBossProducer: vi.fn().mockImplementation(() => ({
    submit: vi.fn(),
  })),
}));

vi.mock('../categorizer', () => ({
  categorizeEmail: vi.fn().mockResolvedValue({
    category: 'action',
    confidence: 0.9,
    requires_confirmation: false,
    reasoning: 'Test reason',
  }),
}));

vi.mock('../state-machine', () => ({
  transitionState: vi.fn().mockResolvedValue(undefined),
}));

describe('pipeline-drafting integration', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };
    (createServiceClient as any).mockReturnValue(mockSupabase);
    (globalThis as any).getBoss = vi.fn().mockResolvedValue({});
  });

  it('should trigger extraction pipeline when email is categorized as action', async () => {
    const email = { id: 'e1', workspace_id: 'w1', client_id: 'c1', subject: 'Sub', body_clean: 'Body' };
    mockSupabase.single
      .mockResolvedValueOnce({ data: email, error: null }) // emails
      .mockResolvedValueOnce({ data: { id: 'i1' }, error: null }); // client_inboxes

    await execute({
      actionType: 'email_categorization',
      emailId: 'e1',
      workspaceId: 'w1',
      signalId: 's1',
    });

    expect(transitionState).toHaveBeenCalledWith('e1', 'w1', 'categorized');
    expect(transitionState).toHaveBeenCalledWith('e1', 'w1', 'extraction_pending');
    expect(PgBossProducer).toHaveBeenCalled();
  });

  it('should NOT trigger extraction pipeline when email is categorized as info', async () => {
    const email = { id: 'e1', workspace_id: 'w1', client_id: 'c1', subject: 'Sub', body_clean: 'Body' };
    mockSupabase.single.mockResolvedValueOnce({ data: email, error: null });

    const { categorizeEmail } = await import('../categorizer');
    (categorizeEmail as any).mockResolvedValueOnce({
      category: 'info',
      confidence: 0.9,
      requires_confirmation: false,
    });

    await execute({
      actionType: 'email_categorization',
      emailId: 'e1',
      workspaceId: 'w1',
      signalId: 's1',
    });

    expect(transitionState).not.toHaveBeenCalled();
    expect(PgBossProducer).not.toHaveBeenCalled();
  });
});
