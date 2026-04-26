import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TimelineList } from '../timeline-list';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
}));

function buildEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: overrides.id ?? 'entry-1',
    workspaceId: 'ws-1',
    agentId: overrides.agentId ?? 'inbox',
    actionType: overrides.actionType ?? 'categorize-email',
    status: overrides.status ?? 'completed',
    input: {},
    output: {},
    correlationId: overrides.correlationId ?? 'corr-1',
    createdAt: overrides.createdAt ?? new Date('2026-01-15T12:00:00Z').toISOString(),
    updatedAt: new Date('2026-01-15T12:00:00Z').toISOString(),
    jobId: 'job-1',
    signalId: null,
    clientId: null,
    idempotencyKey: null,
    trustTierAtExecution: null,
    trustSnapshotId: null,
    startedAt: new Date('2026-01-15T12:00:00Z').toISOString(),
    completedAt: new Date('2026-01-15T12:00:00Z').toISOString(),
    error: null,
    correctedRunId: null,
    correctionDepth: 0,
    correctionIssued: false,
    source: 'agent' as const,
    feedback: null,
  };
}

describe('TimelineList', () => {
  afterEach(() => cleanup());

  it('renders empty state when no entries and no filters', () => {
    render(<TimelineList entries={[]} totalCount={0} filters={{}} grouped={false} onToggleGrouped={vi.fn()} workspaceId="ws-1" userId="u-1" searchParamsStr="" />);
    expect(screen.getByText(/haven't taken any actions yet/i)).toBeDefined();
  });

  it('renders filtered empty state when filters active', () => {
    render(<TimelineList entries={[]} totalCount={50} filters={{ agentId: 'inbox' }} grouped={false} onToggleGrouped={vi.fn()} workspaceId="ws-1" userId="u-1" searchParamsStr="" />);
    expect(screen.getByText(/No actions match your filters/i)).toBeDefined();
  });

  it('renders group toggle button', () => {
    const entries = [buildEntry()];
    render(<TimelineList entries={entries} totalCount={1} filters={{}} grouped={false} onToggleGrouped={vi.fn()} workspaceId="ws-1" userId="u-1" searchParamsStr="" />);
    expect(screen.getByText('Grouped')).toBeDefined();
  });

  it('shows Ungrouped when grouped is true', () => {
    const entries = [buildEntry()];
    render(<TimelineList entries={entries} totalCount={1} filters={{}} grouped={true} onToggleGrouped={vi.fn()} workspaceId="ws-1" userId="u-1" searchParamsStr="" />);
    expect(screen.getByText('Ungrouped')).toBeDefined();
  });

  it('renders pagination when totalPages > 1', () => {
    const entries = Array.from({ length: 25 }, (_, i) => buildEntry({ id: `e-${i}` }));
    render(<TimelineList entries={entries} totalCount={50} filters={{}} grouped={false} onToggleGrouped={vi.fn()} workspaceId="ws-1" userId="u-1" searchParamsStr="" />);
    expect(screen.getByText(/Page 1 of 2/)).toBeDefined();
  });

  it('does not render pagination when only one page', () => {
    const entries = [buildEntry()];
    render(<TimelineList entries={entries} totalCount={1} filters={{}} grouped={false} onToggleGrouped={vi.fn()} workspaceId="ws-1" userId="u-1" searchParamsStr="" />);
    expect(screen.queryByText(/Page/)).toBeNull();
  });

  it('has list role with aria-label', () => {
    const entries = [buildEntry()];
    render(<TimelineList entries={entries} totalCount={1} filters={{}} grouped={false} onToggleGrouped={vi.fn()} workspaceId="ws-1" userId="u-1" searchParamsStr="" />);
    expect(screen.getByRole('list', { name: /agent activity timeline/i })).toBeDefined();
  });
});
