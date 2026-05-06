import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateBrief } from '../brief-generator';
import { createLLMRouter } from '../../shared/llm-router';

vi.mock('../../shared/llm-router', () => ({
  createLLMRouter: vi.fn(),
}));

describe('brief-generator', () => {
  const mockRouter = {
    complete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createLLMRouter as any).mockReturnValue(mockRouter);
  });

  const validContext = {
    workspaceId: 'ws-1',
    since: new Date(),
    hasEmails: true,
    hasInboxes: true,
    clientBreakdown: [],
    handledItems: [] as Array<{ emailId: string; subject: string; sender: string; actionTaken: string; clientName: string }>,
    needsAttentionItems: [] as Array<{ emailId: string; subject: string; sender: string; category: 'urgent' | 'action'; reason: string; clientName: string }>,
    threadSummaries: [],
    rawGroups: [
      {
        clientId: 'c1',
        clientName: 'Client 1',
        emails: [{ id: 'e1', subject: 'Test', sender: 'A', category: 'urgent' }]
      }
    ]
  };

  it('generates a valid brief when LLM returns valid JSON', async () => {
    const validResponse = {
      summaryLine: 'Everything is fine.',
      handledItems: [],
      needsAttentionItems: [
        {
          emailId: '550e8400-e29b-41d4-a716-446655440000',
          subject: 'Test',
          sender: 'A',
          category: 'urgent',
          reason: 'Prompt check',
          clientName: 'Client 1'
        }
      ],
      threadSummaries: [],
      clientBreakdown: []
    };

    mockRouter.complete.mockResolvedValueOnce({ text: JSON.stringify(validResponse) });

    const { brief, isFallback } = await generateBrief(validContext);

    expect(isFallback).toBe(false);
    expect(brief.summaryLine).toBe('Everything is fine.');
    expect(brief.needsAttentionItems).toHaveLength(1);
  });

  it('retries once and then returns fallback on malformed JSON', async () => {
    mockRouter.complete.mockResolvedValue({ text: 'Not JSON' });

    const { brief, isFallback } = await generateBrief(validContext);

    expect(mockRouter.complete).toHaveBeenCalledTimes(2);
    expect(isFallback).toBe(true);
    expect(brief.summaryLine).toContain('Technical issue');
    expect(brief.reassuranceMessage).toContain('Technical issue');
  });

  it('returns fallback on timeout', async () => {
    const abortError = new DOMException('The operation was aborted', 'AbortError');
    mockRouter.complete.mockRejectedValue(abortError);

    const { brief, isFallback } = await generateBrief(validContext);

    expect(isFallback).toBe(true);
    expect(brief.summaryLine).toContain('Technical issue');
  });
});
