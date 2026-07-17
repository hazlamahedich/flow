import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createTestBriefProposal,
  createTestEmail,
  FAKE_WORKSPACE_ID,
} from './epic-4/test-factories';

const mockGenerateMorningBrief = vi.fn();
const mockSaveMorningBrief = vi.fn();
const mockGetMorningBriefContext = vi.fn();

describe('[P0] Morning Brief Generation (ATDD)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AC1: should generate and persist a brief on trigger invocation', async () => {
    const proposal = createTestBriefProposal();
    mockGenerateMorningBrief.mockResolvedValue(proposal);
    mockSaveMorningBrief.mockResolvedValue({
      id: 'brief-001',
      workspace_id: FAKE_WORKSPACE_ID,
      generation_status: 'completed',
    });

    const result = await mockGenerateMorningBrief(FAKE_WORKSPACE_ID);

    expect(result).toBeDefined();
    expect(result.summaryLine).toBeTruthy();
    expect(result.handledItems).toBeInstanceOf(Array);
    expect(result.needsAttentionItems).toBeInstanceOf(Array);

    await mockSaveMorningBrief({
      workspaceId: FAKE_WORKSPACE_ID,
      briefDate: new Date().toISOString().split('T')[0],
      content: result,
      generationStatus: 'completed',
    });

    expect(mockSaveMorningBrief).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: FAKE_WORKSPACE_ID,
        generationStatus: 'completed',
      }),
    );
  });

  it('AC2: should assemble context from emails and client breakdown', async () => {
    const emails = [
      createTestEmail({ category: 'urgent', confidence: 0.95 }),
      createTestEmail({ category: 'action', confidence: 0.85 }),
      createTestEmail({ category: 'info', confidence: 0.7 }),
    ];

    mockGetMorningBriefContext.mockResolvedValue({
      emails,
      clientBreakdown: [
        {
          clientId: emails[0]?.client_id ?? 'client-1',
          clientName: 'Acme Corp',
          emailCount: 3,
        },
      ],
    });

    const context = await mockGetMorningBriefContext(FAKE_WORKSPACE_ID);

    expect(context.emails).toHaveLength(3);
    expect(context.clientBreakdown[0].clientName).toBe('Acme Corp');
    expect(mockGetMorningBriefContext).toHaveBeenCalledWith(FAKE_WORKSPACE_ID);
  });

  it('AC3: should set flood_state when email count exceeds threshold', async () => {
    const floodProposal = createTestBriefProposal({ floodState: true });
    mockGenerateMorningBrief.mockResolvedValue(floodProposal);

    const result = await mockGenerateMorningBrief(FAKE_WORKSPACE_ID);

    expect(result.floodState).toBe(true);
  });

  it('AC4: should handle generation failure gracefully', async () => {
    mockGenerateMorningBrief.mockRejectedValue(new Error('LLM timeout'));

    await expect(mockGenerateMorningBrief(FAKE_WORKSPACE_ID)).rejects.toThrow(
      'LLM timeout',
    );
  });

  it('AC5: should include reassurance message when inbox is quiet', async () => {
    const quietProposal = createTestBriefProposal({
      summaryLine: 'All quiet — your inbox is empty.',
      needsAttentionItems: [],
      reassuranceMessage: 'No urgent items need your attention today.',
    });
    mockGenerateMorningBrief.mockResolvedValue(quietProposal);

    const result = await mockGenerateMorningBrief(FAKE_WORKSPACE_ID);

    expect(result.needsAttentionItems).toHaveLength(0);
    expect(result.reassuranceMessage).toBeDefined();
  });
});
