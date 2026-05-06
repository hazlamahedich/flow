import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractionWorker } from '../extractor';
import { createServiceClient } from '@flow/db';
import { createLLMRouter, tokenizePII, ContextBoundary } from '../../shared/index.js';
import { SAMPLE_EMAILS } from './fixtures/sample-emails';
import { LLM_EXTRACTION_RESPONSES } from './fixtures/llm-extraction-responses';

vi.mock('@flow/db', () => ({
  createServiceClient: vi.fn(),
}));

vi.mock('../../shared/index.js', () => ({
  createLLMRouter: vi.fn(),
  tokenizePII: vi.fn(),
  ContextBoundary: vi.fn(),
}));

vi.mock('../state-machine', () => ({
  transitionState: vi.fn(),
}));

vi.mock('../trust', () => ({
  meetsDraftGate: vi.fn().mockResolvedValue(false),
}));

vi.mock('../flood', () => ({
  isFloodState: vi.fn().mockResolvedValue(false),
}));

vi.mock('../orchestrator/pg-boss-producer.js', () => ({
  PgBossProducer: vi.fn().mockImplementation(() => ({
    submit: vi.fn(),
  })),
}));

describe('extractor', () => {
  let mockSupabase: any;
  let mockLlmRouter: any;
  let mockBoss: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      insert: vi.fn().mockResolvedValue({ error: null }),
    };
    (createServiceClient as any).mockReturnValue(mockSupabase);

    mockLlmRouter = {
      complete: vi.fn(),
    };
    (createLLMRouter as any).mockReturnValue(mockLlmRouter);

    (tokenizePII as any).mockImplementation((text: string) => ({ text, tokens: [] }));
    (ContextBoundary as any).mockImplementation(() => ({
      wrapContent: (text: string) => text,
    }));

    mockBoss = {};
  });

  it('should extract actions and persist them', async () => {
    const email = SAMPLE_EMAILS.simple;
    mockSupabase.single.mockResolvedValue({ data: email, error: null });
    mockLlmRouter.complete.mockResolvedValue({ text: JSON.stringify(LLM_EXTRACTION_RESPONSES.simple) });

    await extractionWorker(
      {
        data: {
          emailId: email.id,
          workspaceId: email.workspace_id,
          clientInboxId: 'i1111111-1111-1111-1111-111111111111',
        },
      } as any,
      mockBoss
    );

    expect(mockSupabase.insert).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ action_type: 'meeting' })])
    );
  });

  it('should filter actions by confidence (items below 0.7 discarded)', async () => {
    const email = SAMPLE_EMAILS.simple;
    mockSupabase.single.mockResolvedValue({ data: email, error: null });
    mockLlmRouter.complete.mockResolvedValue({
      text: JSON.stringify(LLM_EXTRACTION_RESPONSES.lowConfidence),
    });

    await extractionWorker(
      {
        data: {
          emailId: email.id,
          workspaceId: email.workspace_id,
          clientInboxId: 'i1111111-1111-1111-1111-111111111111',
        },
      } as any,
      mockBoss
    );

    expect(mockSupabase.insert).not.toHaveBeenCalled();
  });

  it('should strip quoted text before LLM call', async () => {
    const email = SAMPLE_EMAILS.withQuoted;
    mockSupabase.single.mockResolvedValue({ data: email, error: null });
    mockLlmRouter.complete.mockResolvedValue({ text: JSON.stringify(LLM_EXTRACTION_RESPONSES.empty) });

    await extractionWorker(
      {
        data: {
          emailId: email.id,
          workspaceId: email.workspace_id,
          clientInboxId: 'i1111111-1111-1111-1111-111111111111',
        },
      } as any,
      mockBoss
    );

    const call = mockLlmRouter.complete.mock.calls[0];
    const userMessage = call[0].find((m: any) => m.role === 'user').content;
    expect(userMessage).toContain('Approved. Please proceed.');
    expect(userMessage).not.toContain('Can you approve the budget?');
  });

  it('should cap at 5 actions', async () => {
    const email = SAMPLE_EMAILS.simple;
    mockSupabase.single.mockResolvedValue({ data: email, error: null });
    
    // Create response with 6 actions
    const sixActions = {
        actions: Array(6).fill(LLM_EXTRACTION_RESPONSES.simple.actions[0])
    };
    mockLlmRouter.complete.mockResolvedValue({ text: JSON.stringify(sixActions) });

    await extractionWorker(
      {
        data: {
          emailId: email.id,
          workspaceId: email.workspace_id,
          clientInboxId: 'i1111111-1111-1111-1111-111111111111',
        },
      } as any,
      mockBoss
    );

    const insertCall = mockSupabase.insert.mock.calls[0][0];
    expect(insertCall.length).toBe(5);
  });
});
