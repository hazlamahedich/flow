import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractionWorker } from '../extractor';
import { createServiceClient } from '@flow/db';
import { createLLMRouter, ContextBoundary } from '../../shared/index.js';

vi.mock('@flow/db', () => ({
  createServiceClient: vi.fn(),
}));

vi.mock('../../shared/index.js', () => {
  const actual = vi.importActual('../../shared/index.js');
  return {
    ...actual,
    createLLMRouter: vi.fn(),
    tokenizePII: vi.fn().mockImplementation((t) => ({ text: t, tokens: [] })),
    ContextBoundary: vi.fn().mockImplementation((id) => ({
      wrapContent: (text: string) => `[BOUNDARY_${id}] ${text}`,
    })),
  };
});

vi.mock('../state-machine', () => ({
  transitionState: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../trust', () => ({
  meetsDraftGate: vi.fn().mockResolvedValue(false),
}));

vi.mock('../flood', () => ({
  isFloodState: vi.fn().mockResolvedValue(false),
}));

describe('isolation-leakage', () => {
  let mockSupabase: any;
  let mockLlmRouter: any;

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
      complete: vi.fn().mockResolvedValue({ text: '{"actions": []}' }),
    };
    (createLLMRouter as any).mockReturnValue(mockLlmRouter);
  });

  it('should strictly isolate extraction by client_id in prompts (AC8)', async () => {
    const workspaceId = 'w1';
    const clientA = 'client-A';
    const clientB = 'client-B';
    const emailAId = 'eA';
    const emailBId = 'eB';

    // 1. Process Client A
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: emailAId, client_id: clientA, subject: 'Sub A', body_clean: 'Body A' },
      error: null,
    });

    await extractionWorker(
      { data: { emailId: emailAId, workspaceId, clientInboxId: 'iA' } } as any,
      {} as any
    );

    const callA = mockLlmRouter.complete.mock.calls[0][0][1].content;
    expect(callA).toContain(`[BOUNDARY_${clientA}]`);
    expect(callA).not.toContain(`[BOUNDARY_${clientB}]`);
    expect(ContextBoundary).toHaveBeenCalledWith(clientA);

    // 2. Process Client B
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: emailBId, client_id: clientB, subject: 'Sub B', body_clean: 'Body B' },
      error: null,
    });

    await extractionWorker(
      { data: { emailId: emailBId, workspaceId, clientInboxId: 'iB' } } as any,
      {} as any
    );

    const callB = mockLlmRouter.complete.mock.calls[1][0][1].content;
    expect(callB).toContain(`[BOUNDARY_${clientB}]`);
    expect(callB).not.toContain(`[BOUNDARY_${clientA}]`);
    expect(ContextBoundary).toHaveBeenCalledWith(clientB);
  });

  it('should ensure database inserts include both workspace_id and client_inbox_id (AC8)', async () => {
    const workspaceId = 'w1';
    const clientInboxId = 'i-unique-123';
    const emailId = 'e1';

    mockSupabase.single.mockResolvedValue({
      data: { id: emailId, client_id: 'c1', subject: 'Sub', body_clean: 'Body' },
      error: null,
    });

    mockLlmRouter.complete.mockResolvedValue({
      text: JSON.stringify({
        actions: [
          { actionType: 'task', description: 'Test', confidence: 0.9 }
        ]
      })
    });

    await extractionWorker(
      { data: { emailId, workspaceId, clientInboxId } } as any,
      {} as any
    );

    expect(mockSupabase.insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          workspace_id: workspaceId,
          client_inbox_id: clientInboxId,
        })
      ])
    );
  });
});
