import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../agents/approvals/actions/handled-quietly-actions', () => ({
  getWeeklyAuditCount: vi.fn(),
}));

import { MorningBriefQuietSummary } from '../morning-brief-quiet-summary';
import { getWeeklyAuditCount } from '../../agents/approvals/actions/handled-quietly-actions';

describe('MorningBriefQuietSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when count is 0', async () => {
    (getWeeklyAuditCount as any).mockResolvedValue({
      success: true,
      data: { count: 0 },
    });

    const result = await MorningBriefQuietSummary();
    expect(result).toBeNull();
  });

  it('returns null when request fails', async () => {
    (getWeeklyAuditCount as any).mockResolvedValue({
      success: false,
      error: { code: 500, type: 'INTERNAL_ERROR', message: 'fail' },
    });

    const result = await MorningBriefQuietSummary();
    expect(result).toBeNull();
  });

  it('renders summary with count when data is available', async () => {
    (getWeeklyAuditCount as any).mockResolvedValue({
      success: true,
      data: { count: 7 },
    });

    const jsx = await MorningBriefQuietSummary();

    const { renderToString } = await import('react-dom/server');
    const html = renderToString(jsx);

    expect(html).toContain('Handled Quietly');
    expect(html).toContain('7');
    expect(html).toContain('items handled quietly');
    expect(html).toContain('/agents/approvals');
  });
});
