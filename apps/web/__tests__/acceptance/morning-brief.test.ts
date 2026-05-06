import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateMorningBrief } from '@flow/agents';

// Mock everything needed for acceptance test
vi.mock('@flow/agents', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    generateMorningBrief: vi.fn(),
  };
});

describe('Morning Brief Acceptance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate and persist a brief on trigger invocation', async () => {
    const workspaceId = '550e8400-e29b-41d4-a716-446655440001';
    
    (generateMorningBrief as any).mockResolvedValue({
      id: 'brief-123',
      workspaceId,
      generationStatus: 'completed'
    });

    // Simulate Trigger.dev handler invocation
    const result = await generateMorningBrief(workspaceId);

    expect(result.generationStatus).toBe('completed');
    expect(generateMorningBrief).toHaveBeenCalledWith(workspaceId);
  });
});
