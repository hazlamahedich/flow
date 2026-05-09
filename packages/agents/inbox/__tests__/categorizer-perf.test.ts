import { describe, it, expect, vi, beforeEach } from 'vitest';
import { categorizeEmail } from '../categorizer';

vi.mock('../../shared/index.js', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    createLLMRouter: vi.fn(),
  };
});

describe('categorizer-perf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('completes categorization within 60 seconds (NFR07a P95 target)', async () => {
    const mockRouter = {
      complete: vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return {
          text: JSON.stringify({ category: 'info', confidence: 0.9, reasoning: 'Newsletter' }),
        };
      }),
    };

    const email = {
      subject: 'Weekly newsletter',
      body_clean: 'Here is your weekly digest of industry news and updates.',
      workspace_id: 'ws-1',
      client_id: 'client-1',
    };

    const start = Date.now();
    const result = await categorizeEmail(email, mockRouter as any);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(60000);
    expect(result.category).toBeDefined();
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });

  it('PII tokenization does not dominate categorization latency', async () => {
    const mockRouter = {
      complete: vi.fn().mockResolvedValue({
        text: JSON.stringify({ category: 'action', confidence: 0.8, reasoning: 'Needs reply' }),
      }),
    };

    const emailWithPII = {
      subject: 'Invoice $5,000 from vendor@example.com',
      body_clean: 'Please process payment of $5,000.00 USD. Contact: +1-555-1234, vendor@example.com',
      workspace_id: 'ws-1',
      client_id: 'client-1',
    };

    const start = Date.now();
    await categorizeEmail(emailWithPII, mockRouter as any);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(5000);
  });
});
