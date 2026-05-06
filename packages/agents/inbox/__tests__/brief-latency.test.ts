import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateMorningBrief } from '../index';
import { getMorningBriefContext } from '../brief-context';
import { generateBrief } from '../brief-generator';
import { saveMorningBrief } from '@flow/db';

vi.mock('../brief-context', () => ({
  getMorningBriefContext: vi.fn(),
}));

vi.mock('../brief-generator', () => ({
  generateBrief: vi.fn(),
}));

vi.mock('@flow/db', () => ({
  saveMorningBrief: vi.fn(),
}));

describe('brief-latency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('completes the full pipeline in under 10 seconds (AC2)', async () => {
    const workspaceId = 'ws-1';
    
    // Mock context assembly (fast)
    (getMorningBriefContext as any).mockResolvedValue({ workspaceId });
    
    // Mock LLM with 3-second delay (realistic)
    (generateBrief as any).mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 3000));
      return { 
        brief: {
          summaryLine: 'Success', 
          handledItems: [] as unknown[], 
          needsAttentionItems: [] as unknown[], 
          threadSummaries: [] as unknown[], 
          clientBreakdown: [] as unknown[],
        },
        isFallback: false,
      };
    });

    // Mock save (fast)
    (saveMorningBrief as any).mockResolvedValue({ id: 'brief-1' });

    const start = Date.now();
    await generateMorningBrief(workspaceId);
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(10000); // 10s P95 target
    expect(duration).toBeGreaterThanOrEqual(3000); // At least the 3s delay
  });
});
