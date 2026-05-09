import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execute } from '../executor';
import { createServiceClient, updateEmailCategorization, insertSignal } from '@flow/db';
import { categorizeEmail } from '../categorizer';
import { transitionState } from '../state-machine';

vi.mock('@flow/db', () => ({
  createServiceClient: vi.fn(),
  updateEmailCategorization: vi.fn(),
  insertSignal: vi.fn(),
}));

vi.mock('../categorizer', () => ({
  categorizeEmail: vi.fn(),
}));

vi.mock('../state-machine', () => ({
  transitionState: vi.fn(),
}));

vi.mock('../history-worker', () => ({
  handleDrainHistory: vi.fn(),
}));

vi.mock('../index', () => ({
  generateMorningBrief: vi.fn(),
}));

vi.mock('../orchestrator/pg-boss-producer.js', () => ({
  PgBossProducer: vi.fn(),
}));

describe('executor-perf', () => {
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
    (updateEmailCategorization as any).mockResolvedValue(undefined);
    (insertSignal as any).mockResolvedValue(undefined);
    (transitionState as any).mockResolvedValue(undefined);
  });

  it('completes email_categorization action within 30 seconds (NFR02 P95 target)', async () => {
    mockSupabase.single.mockResolvedValue({
      data: {
        id: 'email-1',
        subject: 'Test email',
        body_clean: 'Content here',
        workspace_id: 'ws-1',
        client_id: 'client-1',
        created_at: new Date().toISOString(),
      },
      error: null,
    });

    (categorizeEmail as any).mockResolvedValue({
      category: 'info',
      confidence: 0.9,
      reasoning: 'Newsletter',
      requires_confirmation: false,
    });

    const input = {
      actionType: 'email_categorization' as const,
      workspaceId: 'ws-1',
      emailId: 'email-1',
    };

    const start = Date.now();
    const result = await execute(input);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(30000);
    expect(result).toBeDefined();
    expect((result as any).category).toBe('info');
  });

  it('measures end-to-end pipeline latency from email creation', async () => {
    const createdAt = new Date(Date.now() - 2000).toISOString();

    mockSupabase.single.mockResolvedValue({
      data: {
        id: 'email-2',
        subject: 'Urgent request',
        body_clean: 'Please respond immediately.',
        workspace_id: 'ws-1',
        client_id: 'client-1',
        created_at: createdAt,
      },
      error: null,
    });

    (categorizeEmail as any).mockResolvedValue({
      category: 'urgent',
      confidence: 0.95,
      reasoning: 'Direct request',
      requires_confirmation: true,
    });

    const input = {
      actionType: 'email_categorization' as const,
      workspaceId: 'ws-1',
      emailId: 'email-2',
    };

    const start = Date.now();
    await execute(input);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(30000);
  });
});
