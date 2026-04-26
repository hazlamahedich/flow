import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ActivityTimelineClient } from '../activity-timeline-client';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('../activity-filters', () => ({
  ActivityFilters: () => <div data-testid="activity-filters" />,
}));

vi.mock('../timeline-inhaler', () => ({
  TimelineInhaler: () => <div data-testid="timeline-inhaler" />,
}));

vi.mock('../timeline-list', () => ({
  TimelineList: () => <div data-testid="timeline-list" />,
}));

describe('ActivityTimelineClient', () => {
  afterEach(() => cleanup());

  it('renders filters, inhaler, and list', () => {
    render(<ActivityTimelineClient initialData={[]} totalCount={0} filters={{}} workspaceId="ws-1" userId="u-1" />);
    expect(screen.getByTestId('activity-filters')).toBeDefined();
    expect(screen.getByTestId('timeline-inhaler')).toBeDefined();
    expect(screen.getByTestId('timeline-list')).toBeDefined();
  });

  it('has aria-keyshortcuts on container', () => {
    render(<ActivityTimelineClient initialData={[]} totalCount={0} filters={{}} workspaceId="ws-1" userId="u-1" />);
    const container = screen.getByTestId('activity-filters').parentElement;
    expect(container?.getAttribute('aria-keyshortcuts')).toBe('f g');
  });
});
