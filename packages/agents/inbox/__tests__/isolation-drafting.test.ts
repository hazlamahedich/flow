import { describe, it, expect, vi, beforeEach } from 'vitest';
import { draftWorker } from '../drafter';
import { createServiceClient } from '@flow/db';
import { createLLMRouter, tokenizePII, ContextBoundary } from '../../shared/index.js';

vi.mock('@flow/db', () => ({
  createServiceClient: vi.fn(),
}));

vi.mock('../../shared/index.js', () => ({
  createLLMRouter: vi.fn(),
  tokenizePII: vi.fn(),
  detokenizePII: vi.fn((t) => t),
  ContextBoundary: vi.fn().mockImplementation((id) => ({
    wrapContent: (text: string) => `[BOUNDARY_${id}] ${text}`,
  })),
}));

vi.mock('../state-machine', () => ({
  transitionState: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../voice', () => ({
  loadVoiceContext: vi.fn().mockImplementation((ws, id) =>
    Promise.resolve({
      tone: 'professional',
      formalityScore: 7,
      toneDescriptors: [],
      exemplarBlock: `[VOICE_${id}]`,
    })
  ),
  buildDraftPrompt: vi.fn().mockImplementation((ctx, text) => `${ctx.exemplarBlock} ${text}`),
}));

vi.mock('../trust', () => ({
  computeTrustLevel: vi.fn().mockResolvedValue(2),
}));

describe('isolation-drafting', () => {
  let mockSupabase: any;
  let mockLlmRouter: any;

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
  });

  it('should isolate drafting by client context', async () => {
    const clientA = 'client-A';

    const emailChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { client_id: clientA, body_clean: 'Email A', subject: 'Subject A' },
        error: null,
      }),
    };
    const actionsChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    };
    actionsChain.eq.mockReturnValueOnce(actionsChain).mockResolvedValue({ data: [], error: null });

    const insertChain = {
      insert: vi.fn().mockResolvedValue({ error: null }),
    };

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'emails') return emailChain;
      if (table === 'extracted_actions') return actionsChain;
      if (table === 'draft_responses') return insertChain;
      return {};
    });

    mockLlmRouter.complete.mockResolvedValue({ text: 'Draft A' });

    await draftWorker(
      { data: { emailId: 'eA', workspaceId: 'w1', clientInboxId: 'iA' } } as any,
      {} as any
    );

    expect(ContextBoundary).toHaveBeenCalledWith(clientA);
    const callA = mockLlmRouter.complete.mock.calls[0][0][1].content;
    expect(callA).toContain(`[BOUNDARY_${clientA}]`);
    expect(callA).toContain(`[VOICE_${clientA}]`);
  });
});
