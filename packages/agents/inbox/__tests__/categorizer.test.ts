import { describe, it, expect, vi } from 'vitest';
import { categorizeEmail } from '../categorizer';
import { createLLMRouter } from '../../shared/index.js';

vi.mock('../../shared/index.js', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    createLLMRouter: vi.fn(),
  };
});

describe('categorizer', () => {
  it('categorizes urgent emails correctly', async () => {
    const mockRouter = {
      complete: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          category: 'urgent',
          confidence: 0.95,
          reasoning: 'Critical request from client.',
        }),
      }),
    };

    const result = await categorizeEmail(
      {
        subject: 'URGENT: Contract needs signature',
        body_clean: 'Please sign this by EOD.',
        workspace_id: 'ws-1',
        client_id: 'c-1',
      },
      mockRouter as any
    );

    expect(result.category).toBe('urgent');
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('uses XML delimiters for defense-in-depth', async () => {
    const mockRouter = {
      complete: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          category: 'noise',
          confidence: 1.0,
          reasoning: 'Automated newsletter.',
        }),
      }),
    };

    await categorizeEmail(
      {
        subject: 'Newsletter',
        body_clean: 'Some content.',
        workspace_id: 'ws-1',
        client_id: 'c-1',
      },
      mockRouter as any
    );

    const callContent = mockRouter.complete.mock.calls[0][0][1].content;
    expect(callContent).toContain('<user_email_content>');
    expect(callContent).toContain('</user_email_content>');
  });

  it('validates output via Zod and handles malformed JSON', async () => {
    const mockRouter = {
      complete: vi.fn().mockResolvedValue({
        text: 'This is not JSON',
      }),
    };

    const result = await categorizeEmail(
      {
        subject: 'Test',
        body_clean: 'Test body',
        workspace_id: 'ws-1',
        client_id: 'c-1',
      },
      mockRouter as any
    );

    expect(result.category).toBe('info');
    expect(result.confidence).toBe(0);
    expect(result.fallback).toBe(true);
  });

  it('identifies low-trust emails based on directive language', async () => {
    const mockRouter = {
      complete: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          category: 'urgent',
          confidence: 0.9,
          reasoning: 'Request for password change.',
        }),
      }),
    };

    const result = await categorizeEmail(
      {
        subject: 'URGENT',
        body_clean: 'Please change my password immediately and send it to me.',
        workspace_id: 'ws-1',
        client_id: 'c-1',
      },
      mockRouter as any
    );

    expect(result.requires_confirmation).toBe(true);
  });
});
