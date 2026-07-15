import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('@flow/db', () => ({
  requireTenantContext: vi.fn(),
}));

vi.mock('@flow/agents/inbox', () => ({
  morningBriefOutputSchema: {
    safeParse: vi.fn(),
  },
}));

vi.mock('../morning-brief-tracker', () => ({
  MorningBriefTracker: () => <div data-testid="brief-tracker" />,
}));

vi.mock('../flood-state-banner', () => ({
  FloodStateBanner: () => <div>High Volume Detected</div>,
}));

vi.mock('../collapsed-email-cluster', () => ({
  CollapsedEmailCluster: ({
    title,
    items,
  }: {
    title: string;
    items: any[];
  }) => (
    <div>
      {title} ({items.length})
    </div>
  ),
}));

vi.mock('../morning-brief-quiet-summary', () => ({
  MorningBriefQuietSummary: () => null,
}));

vi.mock('@flow/ui', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
  Button: ({ children }: { children: React.ReactNode }) => (
    <button>{children}</button>
  ),
}));

import { MorningBrief } from '../morning-brief';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext } from '@flow/db';
import { morningBriefOutputSchema } from '@flow/agents/inbox';

describe('MorningBrief', () => {
  const mockSupabase: any = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
  };

  const standardContent = {
    summaryLine: 'All clear today',
    handledItems: [
      {
        emailId: '00000000-0000-0000-0000-000000000001',
        subject: 'Handled 1',
        sender: 'sender@example.com',
        clientName: 'Client A',
        actionTaken: 'Drafted',
      },
    ],
    needsAttentionItems: [
      {
        emailId: '00000000-0000-0000-0000-000000000002',
        subject: 'Urgent 1',
        sender: 'sender2@example.com',
        clientName: 'Client B',
        category: 'urgent',
        reason: 'High priority',
      },
    ],
    threadSummaries: [],
    clientBreakdown: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getServerSupabase as any).mockResolvedValue(mockSupabase);
    (requireTenantContext as any).mockResolvedValue({ workspaceId: 'ws-1' });
    (morningBriefOutputSchema.safeParse as any).mockReturnValue({
      success: true,
      data: standardContent,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders standard density when floodState is false', async () => {
    mockSupabase.maybeSingle.mockResolvedValue({
      data: {
        id: 'b-1',
        generation_status: 'completed',
        content: standardContent,
        flood_state: false,
      },
      error: null,
    });

    const jsx = await MorningBrief();
    render(jsx);

    expect(screen.getByText('Handled Overnight')).toBeDefined();
    expect(screen.getByText('Requires Your Attention')).toBeDefined();
    expect(screen.queryByText('High Volume Detected')).toBeNull();
  });

  it('renders high density when floodState is true', async () => {
    (morningBriefOutputSchema.safeParse as any).mockReturnValue({
      success: true,
      data: { ...standardContent, floodState: true },
    });

    mockSupabase.maybeSingle.mockResolvedValue({
      data: {
        id: 'b-1',
        generation_status: 'completed',
        content: { ...standardContent, floodState: true },
        flood_state: true,
      },
      error: null,
    });

    const jsx = await MorningBrief();
    render(jsx);

    expect(screen.getByText('High Volume Detected')).toBeDefined();
    expect(screen.getByText('Handled Overnight (1)')).toBeDefined();
    expect(screen.getByText('Requires Your Attention (1)')).toBeDefined();
  });

  it('returns null when no brief exists but inboxes exist', async () => {
    mockSupabase.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });
    mockSupabase.limit.mockResolvedValueOnce({
      data: [{ id: 'inbox-1' }],
      error: null,
    });

    const result = await MorningBrief();
    expect(result).toBeNull();
  });

  it('returns error state when schema validation fails', async () => {
    (morningBriefOutputSchema.safeParse as any).mockReturnValue({
      success: false,
      error: { issues: ['invalid'] },
    });

    mockSupabase.maybeSingle.mockResolvedValue({
      data: {
        id: 'b-1',
        generation_status: 'completed',
        content: {},
        flood_state: false,
      },
      error: null,
    });

    const jsx = await MorningBrief();
    render(jsx);

    expect(screen.getByText(/Technical issue generating today/)).toBeDefined();
  });

  it('shows failed state when generation_status is failed', async () => {
    mockSupabase.maybeSingle.mockResolvedValue({
      data: {
        id: 'b-1',
        generation_status: 'failed',
        content: null,
        flood_state: false,
      },
      error: null,
    });

    const jsx = await MorningBrief();
    render(jsx);

    expect(screen.getByText(/Technical issue generating today/)).toBeDefined();
  });

  it('shows connect inbox prompt when no inboxes exist', async () => {
    mockSupabase.maybeSingle.mockResolvedValue({ data: null, error: null });

    const limitChain = { data: [], error: null };
    mockSupabase.limit.mockResolvedValueOnce(limitChain);
    mockSupabase.eq.mockReturnThis();

    const jsx = await MorningBrief();
    render(jsx);

    expect(
      screen.getByText('Connect an inbox to get your first Morning Brief'),
    ).toBeDefined();
  });

  describe('inhale-before-exhale pattern (UX-DR6)', () => {
    it('renders summaryLine before item sections', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: {
          id: 'b-1',
          generation_status: 'completed',
          content: standardContent,
          flood_state: false,
        },
        error: null,
      });

      const jsx = await MorningBrief();
      const { container } = render(jsx);

      const summaryEl = screen.getByText('All clear today');
      const handledEl = screen.getByText('Handled Overnight');
      const attentionEl = screen.getByText('Requires Your Attention');

      const allNodes = Array.from(container.querySelectorAll('*'));
      const summaryIdx = allNodes.indexOf(summaryEl);
      const handledIdx = allNodes.indexOf(handledEl);
      const attentionIdx = allNodes.indexOf(attentionEl);

      expect(summaryIdx).toBeLessThan(handledIdx);
      expect(summaryIdx).toBeLessThan(attentionIdx);
    });
  });

  describe('habit anchor ordering (UX-DR41)', () => {
    it('renders handled items before attention items', async () => {
      mockSupabase.maybeSingle.mockResolvedValue({
        data: {
          id: 'b-1',
          generation_status: 'completed',
          content: standardContent,
          flood_state: false,
        },
        error: null,
      });

      const jsx = await MorningBrief();
      const { container } = render(jsx);

      const handledEl = screen.getByText('Handled Overnight');
      const attentionEl = screen.getByText('Requires Your Attention');

      const allNodes = Array.from(container.querySelectorAll('*'));
      const handledIdx = allNodes.indexOf(handledEl);
      const attentionIdx = allNodes.indexOf(attentionEl);

      expect(handledIdx).toBeLessThan(attentionIdx);
    });
  });

  describe('empty inbox reassurance (UX-DR15)', () => {
    it('shows reassurance message when no items exist', async () => {
      const emptyContent = {
        summaryLine: 'All clear',
        handledItems: [],
        needsAttentionItems: [],
        threadSummaries: [],
        clientBreakdown: [],
      };

      (morningBriefOutputSchema.safeParse as any).mockReturnValue({
        success: true,
        data: emptyContent,
      });

      mockSupabase.maybeSingle.mockResolvedValue({
        data: {
          id: 'b-1',
          generation_status: 'completed',
          content: emptyContent,
          flood_state: false,
          generated_at: new Date().toISOString(),
        },
        error: null,
      });

      const jsx = await MorningBrief();
      render(jsx);

      expect(
        screen.getByText(/All clear.*your agents handled everything/i),
      ).toBeDefined();
    });
  });
});
