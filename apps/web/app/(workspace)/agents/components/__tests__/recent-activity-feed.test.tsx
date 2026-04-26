import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { RecentActivityFeed } from '../recent-activity-feed';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

function buildEntry(overrides: Partial<{
  id: string;
  agentId: string;
  actionType: string;
  correlationId: string;
  createdAt: string;
}> = {}) {
  return {
    id: overrides.id ?? 'entry-1',
    workspaceId: 'ws-1',
    agentId: (overrides.agentId ?? 'inbox') as 'inbox',
    actionType: overrides.actionType ?? 'categorize-email',
    status: 'completed' as const,
    input: {},
    output: {},
    correlationId: overrides.correlationId ?? 'corr-1',
    createdAt: overrides.createdAt ?? new Date('2025-06-15T12:00:00Z').toISOString(),
    updatedAt: new Date('2025-06-15T12:00:00Z').toISOString(),
    jobId: 'job-1',
    signalId: null,
    clientId: null,
    idempotencyKey: null,
    trustTierAtExecution: null,
    trustSnapshotId: null,
    startedAt: new Date('2025-06-15T12:00:00Z').toISOString(),
    completedAt: new Date('2025-06-15T12:00:00Z').toISOString(),
    error: null,
    correctedRunId: null,
    correctionDepth: 0,
    correctionIssued: false,
    source: 'agent' as const,
    feedback: null,
  };
}

describe('RecentActivityFeed', () => {
  beforeEach(() => { vi.useFakeTimers({ now: new Date('2025-06-15T12:00:00Z') }); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('renders empty state', () => {
    render(<RecentActivityFeed entries={[]} />);
    expect(screen.getByText(/No agent activity yet/)).toBeDefined();
  });

  it('renders single entry with agent label and action type', () => {
    render(<RecentActivityFeed entries={[buildEntry()]} />);
    expect(screen.getByText('Inbox')).toBeDefined();
    expect(screen.getByText('categorize-email')).toBeDefined();
  });

  it('renders relative time for recent entries', () => {
    render(<RecentActivityFeed entries={[buildEntry()]} />);
    expect(screen.getByText('just now')).toBeDefined();
  });

  it('renders relative time for older entries', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    render(<RecentActivityFeed entries={[buildEntry({ createdAt: fiveMinutesAgo })]} />);
    expect(screen.getByText('5m ago')).toBeDefined();
  });

  it('renders multi-agent coordination group for 3+ entries with same correlationId', () => {
    const entries = [
      buildEntry({ id: 'e1', agentId: 'inbox', correlationId: 'corr-x' }),
      buildEntry({ id: 'e2', agentId: 'calendar', correlationId: 'corr-x' }),
      buildEntry({ id: 'e3', agentId: 'ar-collection', correlationId: 'corr-x' }),
    ];

    render(<RecentActivityFeed entries={entries} />);
    expect(screen.getByText('3-agent coordination completed')).toBeDefined();
    expect(screen.getByText(/\(Inbox, Calendar, AR Collection\)/)).toBeDefined();
  });

  it('renders single entries when correlationId has fewer than 3 entries', () => {
    const entries = [
      buildEntry({ id: 'e1', agentId: 'inbox', correlationId: 'corr-x', actionType: 'categorize-email' }),
      buildEntry({ id: 'e2', agentId: 'calendar', correlationId: 'corr-x', actionType: 'schedule-check' }),
    ];

    render(<RecentActivityFeed entries={entries} />);
    expect(screen.queryByText(/coordination completed/)).toBeNull();
    expect(screen.getByText('categorize-email')).toBeDefined();
    expect(screen.getByText('schedule-check')).toBeDefined();
  });

  it('shows View full timeline link', () => {
    render(<RecentActivityFeed entries={[buildEntry()]} />);
    const links = screen.getAllByRole('link');
    const timelineLink = links.find((l) => l.getAttribute('href') === '/agents/activity');
    expect(timelineLink).toBeDefined();
    expect(timelineLink!.textContent).toContain('View full timeline');
  });

  it('renders mixed single and grouped entries', () => {
    const entries = [
      buildEntry({ id: 'e1', agentId: 'inbox', correlationId: 'corr-group' }),
      buildEntry({ id: 'e2', agentId: 'calendar', correlationId: 'corr-group' }),
      buildEntry({ id: 'e3', agentId: 'ar-collection', correlationId: 'corr-group' }),
      buildEntry({ id: 'e4', agentId: 'weekly-report', correlationId: 'corr-solo', actionType: 'weekly-digest' }),
    ];

    render(<RecentActivityFeed entries={entries} />);
    const groups = screen.getAllByText('3-agent coordination completed');
    expect(groups.length).toBeGreaterThan(0);
    expect(screen.getByText('weekly-digest')).toBeDefined();
  });

  it('limits display to 5 items maximum', () => {
    const entries = Array.from({ length: 8 }, (_, i) =>
      buildEntry({ id: `e${i}`, correlationId: `corr-${i}`, actionType: `action-${i}` }),
    );

    render(<RecentActivityFeed entries={entries} />);
    const actionLabels = screen.getAllByText(/action-\d/);
    expect(actionLabels.length).toBeLessThanOrEqual(5);
  });

  it('renders hours ago for entries older than 60 minutes', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    render(<RecentActivityFeed entries={[buildEntry({ createdAt: twoHoursAgo })]} />);
    expect(screen.getByText('2h ago')).toBeDefined();
  });

  it('renders days ago for entries older than 24 hours', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    render(<RecentActivityFeed entries={[buildEntry({ createdAt: threeDaysAgo })]} />);
    expect(screen.getByText('3d ago')).toBeDefined();
  });
});
