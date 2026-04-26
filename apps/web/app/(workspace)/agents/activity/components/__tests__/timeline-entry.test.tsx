import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimelineEntry } from '../timeline-entry';

vi.mock('./action-detail-panel', () => ({
  ActionDetailPanel: ({ entry, onClose }: { entry: Record<string, unknown>; onClose: () => void }) => (
    <div data-testid="detail-panel">
      <span>{String(entry.actionType)}</span>
      <button onClick={onClose}>Close</button>
    </div>
  ),
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
    correlationId: 'corr-1',
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    jobId: 'job-1',
    signalId: null,
    clientId: null,
    idempotencyKey: null,
    trustTierAtExecution: null,
    trustSnapshotId: null,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    error: null,
    correctedRunId: null,
    correctionDepth: 0,
    correctionIssued: overrides.correctionIssued ?? false,
    source: 'agent',
    feedback: null,
    ...overrides,
  } as any;
}

describe('TimelineEntry', () => {
  beforeEach(() => vi.useFakeTimers({ now: new Date('2026-01-15T12:00:00Z') }));
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it('renders agent label', () => {
    render(<TimelineEntry entry={buildEntry()} workspaceId="ws-1" />);
    expect(screen.getByText('Inbox')).toBeDefined();
  });

  it('renders action type', () => {
    render(<TimelineEntry entry={buildEntry({ actionType: 'categorize-email' })} workspaceId="ws-1" />);
    expect(screen.getByText('categorize-email')).toBeDefined();
  });

  it('renders completed status badge', () => {
    render(<TimelineEntry entry={buildEntry({ status: 'completed' })} workspaceId="ws-1" />);
    expect(screen.getByText('Completed')).toBeDefined();
  });

  it('renders failed status badge', () => {
    render(<TimelineEntry entry={buildEntry({ status: 'failed' })} workspaceId="ws-1" />);
    expect(screen.getByText('Failed')).toBeDefined();
  });

  it('renders timed_out status badge', () => {
    render(<TimelineEntry entry={buildEntry({ status: 'timed_out' })} workspaceId="ws-1" />);
    expect(screen.getByText('Timed out')).toBeDefined();
  });

  it('renders corrected badge when correction issued', () => {
    render(<TimelineEntry entry={buildEntry({ correctionIssued: true })} workspaceId="ws-1" />);
    expect(screen.getByText('Corrected')).toBeDefined();
  });

  it('does not render corrected badge when no correction', () => {
    render(<TimelineEntry entry={buildEntry({ correctionIssued: false })} workspaceId="ws-1" />);
    expect(screen.queryByText('Corrected')).toBeNull();
  });

  it('has listitem role', () => {
    render(<TimelineEntry entry={buildEntry()} workspaceId="ws-1" />);
    expect(screen.getByRole('listitem')).toBeDefined();
  });

  it('is focusable', () => {
    render(<TimelineEntry entry={buildEntry()} workspaceId="ws-1" />);
    expect(screen.getByRole('listitem').getAttribute('tabindex')).toBe('0');
  });
});
