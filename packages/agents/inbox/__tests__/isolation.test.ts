import { describe, it, expect, vi } from 'vitest';
import { categorizeEmail } from '../categorizer';
import { ContextBoundary, createLLMRouter } from '../../shared/index.js';

vi.mock('../../shared/index.js', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    ContextBoundary: vi.fn().mockImplementation((id) => ({
      clientId: id,
      wrapContent: vi.fn().mockImplementation((content, tag) => `<${tag}>${content}</${tag}>`),
    })),
    createLLMRouter: vi.fn(),
  };
});

describe('inbox isolation', () => {
  it('strictly scopes categorization to a single client_id (AC8)', async () => {
    const mockRouter = {
      complete: vi.fn().mockResolvedValue({
        text: JSON.stringify({ category: 'info', confidence: 1.0, reasoning: 'test' }),
      }),
    };

    const clientId = 'client-alpha';
    await categorizeEmail(
      {
        subject: 'Test',
        body_clean: 'Test',
        workspace_id: 'ws-1',
        client_id: clientId,
      },
      mockRouter as any
    );

    expect(ContextBoundary).toHaveBeenCalledWith(clientId);
  });

  it('ensures no cross-client context leakage in prompt wrapping', async () => {
    const mockRouter = {
      complete: vi.fn().mockResolvedValue({
        text: JSON.stringify({ category: 'info', confidence: 1.0, reasoning: 'test' }),
      }),
    };

    const clientId = 'client-beta';
    await categorizeEmail(
      {
        subject: 'Confidential',
        body_clean: 'Beta data only',
        workspace_id: 'ws-1',
        client_id: clientId,
      },
      mockRouter as any
    );

    // Verify ContextBoundary was instantiated with the correct client
    expect(ContextBoundary).toHaveBeenCalledWith(clientId);
    
    // Verify user message contains the wrapped content
    const calls = (mockRouter.complete as any).mock.calls;
    const userMessage = calls[0][0].find((m: any) => m.role === 'user');
    expect(userMessage.content).toContain('<user_email_content>');
    expect(userMessage.content).toContain('Beta data only');
  });
});
