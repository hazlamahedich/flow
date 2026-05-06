import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MorningBrief } from '../morning-brief';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext } from '@flow/db';

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

vi.mock('@flow/db', () => ({
  requireTenantContext: vi.fn(),
}));

vi.mock('../morning-brief-tracker', () => ({
  MorningBriefTracker: () => <div data-testid="brief-tracker" />,
}));

describe('MorningBrief', () => {
  const mockSupabase: any = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (getServerSupabase as any).mockResolvedValue(mockSupabase);
    (requireTenantContext as any).mockResolvedValue({ workspaceId: 'ws-1' });
  });

  const standardContent = {
    summaryLine: 'All clear today',
    handledItems: [
      { 
        emailId: '00000000-0000-0000-0000-000000000001', 
        subject: 'Handled 1', 
        sender: 'sender@example.com',
        clientName: 'Client A', 
        actionTaken: 'Drafted' 
      },
    ],
    needsAttentionItems: [
      { 
        emailId: '00000000-0000-0000-0000-000000000002', 
        subject: 'Urgent 1', 
        sender: 'sender2@example.com',
        clientName: 'Client B', 
        category: 'urgent', 
        reason: 'High priority' 
      },
    ],
    threadSummaries: [],
    clientBreakdown: [],
  };

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
    // In condensed view, titles have counts
    expect(screen.getByText(/Handled Overnight \(1\)/)).toBeDefined();
    expect(screen.getByText(/Requires Your Attention \(1\)/)).toBeDefined();
  });
});
