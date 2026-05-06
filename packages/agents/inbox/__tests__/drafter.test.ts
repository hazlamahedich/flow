import { describe, it, expect, vi, beforeEach } from 'vitest';
import { draftWorker } from '../drafter';
import { createServiceClient } from '@flow/db';
import { createLLMRouter, tokenizePII, detokenizePII, ContextBoundary } from '../../shared/index.js';
import { SAMPLE_EMAILS } from './fixtures/sample-emails';
import { LLM_DRAFT_RESPONSES } from './fixtures/llm-draft-responses';

vi.mock('@flow/db', () => ({
  createServiceClient: vi.fn(),
}));

vi.mock('../../shared/index.js', () => ({
  createLLMRouter: vi.fn(),
  tokenizePII: vi.fn(),
  detokenizePII: vi.fn(),
  ContextBoundary: vi.fn(),
}));

vi.mock('../state-machine', () => ({
  transitionState: vi.fn().mockResolvedValue(undefined),
  getProcessingState: vi.fn().mockResolvedValue('draft_pending'),
}));

vi.mock('../voice', () => ({
  loadVoiceContext: vi.fn().mockResolvedValue({
    tone: 'professional',
    formalityScore: 7,
    toneDescriptors: ['professional', 'concise', 'helpful'],
    exemplarBlock: '',
  }),
  buildDraftPrompt: vi.fn().mockReturnValue('Mock Prompt'),
}));

vi.mock('../trust', () => ({
  computeTrustLevel: vi.fn().mockResolvedValue(2),
}));

describe('drafter', () => {
  let mockSupabase: any;
  let mockLlmRouter: any;
  let mockBoss: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockSupabase = {
      from: vi.fn(),
    };
    
    (createServiceClient as any).mockReturnValue(mockSupabase);

    mockLlmRouter = {
      complete: vi.fn(),
    };
    (createLLMRouter as any).mockReturnValue(mockLlmRouter);

    (tokenizePII as any).mockImplementation((text: string) => ({ text, tokens: [] }));
    (detokenizePII as any).mockImplementation((text: string) => text);
    (ContextBoundary as any).mockImplementation(() => ({
      wrapContent: (text: string) => text,
    }));

    mockBoss = {};
  });

  it('should generate draft and persist it', async () => {
    const email = SAMPLE_EMAILS.simple;
    
    // Mock chain for emails
    const emailChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: email, error: null })
    };

    // Mock chain for actions
    const actionsChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    };
    actionsChain.eq.mockReturnValueOnce(actionsChain).mockResolvedValue({ data: [], error: null });

    // Mock chain for profile
    const profileChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'p1' }, error: null }),
    };

    // Mock for draft_responses
    const insertChain = {
      insert: vi.fn().mockResolvedValue({ error: null })
    };

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'emails') return emailChain;
      if (table === 'extracted_actions') return actionsChain;
      if (table === 'workspace_voice_profiles') return profileChain;
      if (table === 'draft_responses') return insertChain;
      return {};
    });

    mockLlmRouter.complete.mockResolvedValue({ text: LLM_DRAFT_RESPONSES.simple.text });

    await draftWorker(
      {
        data: {
          emailId: email.id,
          workspaceId: email.workspace_id,
          clientInboxId: 'i1111111-1111-1111-1111-111111111111',
        },
      } as any,
      mockBoss
    );

    expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        draft_content: expect.stringContaining("I'd be happy to meet"),
        trust_at_generation: 2,
        voice_profile_id: 'p1',
      })
    );
  });
});
