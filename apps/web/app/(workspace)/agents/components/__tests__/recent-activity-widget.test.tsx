import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('@flow/db', () => ({
  getRecentActivity: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

describe('RecentActivityWidget', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it('renders feed with fetched entries', async () => {
    const { getRecentActivity } = await import('@flow/db');
    vi.mocked(getRecentActivity).mockResolvedValueOnce([]);
    const { RecentActivityWidget } = await import('../recent-activity-widget');
    render(await RecentActivityWidget({ workspaceId: 'ws-1' }));
    expect(getRecentActivity).toHaveBeenCalledWith('ws-1', 5);
  });
});
