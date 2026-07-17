import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../actions/handled-quietly-actions', () => ({
  getHandledEmails: vi.fn(),
}));

vi.mock('@/lib/supabase-server', () => ({
  getServerSupabase: vi.fn(),
}));

import { HandledQuietlySection } from '../handled-quietly-section';
import { getHandledEmails } from '../../actions/handled-quietly-actions';

describe('HandledQuietlySection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when getHandledEmails fails', async () => {
    (getHandledEmails as any).mockResolvedValue({
      success: false,
      error: { code: 500, type: 'INTERNAL_ERROR', message: 'fail' },
    });

    const result = await HandledQuietlySection({ workspaceId: 'ws-1' });
    expect(result).toBeNull();
  });

  it('returns null when totalCount is 0', async () => {
    (getHandledEmails as any).mockResolvedValue({
      success: true,
      data: { items: [], totalCount: 0 },
    });

    const result = await HandledQuietlySection({ workspaceId: 'ws-1' });
    expect(result).toBeNull();
  });

  it('renders items when data is available', async () => {
    const items = [
      {
        id: 'e-1',
        subject: 'Test 1',
        sender: 'a@b.com',
        category: 'info',
        received_at: new Date().toISOString(),
        confidence: 0.9,
      },
      {
        id: 'e-2',
        subject: 'Test 2',
        sender: 'c@d.com',
        category: 'noise',
        received_at: new Date().toISOString(),
        confidence: 0.7,
      },
    ];
    (getHandledEmails as any).mockResolvedValue({
      success: true,
      data: { items, totalCount: 2 },
    });

    const jsx = await HandledQuietlySection({ workspaceId: 'ws-1' });

    const { renderToString } = await import('react-dom/server');
    const html = renderToString(jsx);

    expect(html).toContain('Handled Quietly');
    expect(html).toContain('Test 1');
    expect(html).toContain('Test 2');
  });

  it('shows pagination hint when totalCount exceeds items.length', async () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      id: `e-${i}`,
      subject: `Email ${i}`,
      sender: `s${i}@x.com`,
      category: 'info',
      received_at: new Date().toISOString(),
      confidence: 0.8,
    }));
    (getHandledEmails as any).mockResolvedValue({
      success: true,
      data: { items, totalCount: 25 },
    });

    const jsx = await HandledQuietlySection({ workspaceId: 'ws-1' });

    const { renderToString } = await import('react-dom/server');
    const html = renderToString(jsx);

    expect(html).toContain('Showing latest 10 items');
    expect(html).toContain('25');
  });

  describe('UX-DR27: gold accent divider with collapsed green items', () => {
    it('renders gold accent divider border', async () => {
      const items = [
        {
          id: 'e-1',
          subject: 'Auto-replied',
          sender: 'a@b.com',
          category: 'info',
          received_at: new Date().toISOString(),
          confidence: 0.95,
        },
      ];
      (getHandledEmails as any).mockResolvedValue({
        success: true,
        data: { items, totalCount: 1 },
      });

      const jsx = await HandledQuietlySection({ workspaceId: 'ws-1' });

      const { renderToString } = await import('react-dom/server');
      const html = renderToString(jsx);

      expect(html).toContain('border-amber-500');
      expect(html).toContain('Handled Quietly');
    });

    it('renders handled items with confidence indicators', async () => {
      const items = [
        {
          id: 'e-1',
          subject: 'Handled',
          sender: 'x@y.com',
          category: 'info',
          received_at: new Date().toISOString(),
          confidence: 0.85,
        },
      ];
      (getHandledEmails as any).mockResolvedValue({
        success: true,
        data: { items, totalCount: 1 },
      });

      const jsx = await HandledQuietlySection({ workspaceId: 'ws-1' });

      const { renderToString } = await import('react-dom/server');
      const html = renderToString(jsx);

      expect(html).toContain('85%');
    });
  });
});
