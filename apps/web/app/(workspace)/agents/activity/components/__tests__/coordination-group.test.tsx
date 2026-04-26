import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CoordinationGroupComponent } from '../coordination-group';

vi.mock('../timeline-entry', () => ({
  TimelineEntry: ({ entry }: { entry: Record<string, unknown> }) => (
    <div data-testid="timeline-entry">{String(entry.id)}</div>
  ),
}));

function buildGroup(overrides: Record<string, unknown> = {}) {
  return {
    correlationId: overrides.correlationId ?? 'corr-1',
    signalCount: overrides.signalCount ?? 0,
    runCount: overrides.runCount ?? 2,
    agents: overrides.agents ?? ['inbox', 'calendar'],
    firstCreatedAt: overrides.firstCreatedAt ?? new Date().toISOString(),
    lastCompletedAt: overrides.lastCompletedAt ?? null,
    runs: overrides.runs ?? [
      { id: 'run-1', agentId: 'inbox', actionType: 'categorize', status: 'completed', createdAt: new Date().toISOString(), workspaceId: 'ws-1', correctionIssued: false, correctionDepth: 0, output: {}, input: {}, correlationId: 'corr-1', updatedAt: new Date().toISOString(), jobId: 'j1', signalId: null, clientId: null, idempotencyKey: null, trustTierAtExecution: null, trustSnapshotId: null, startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), error: null, correctedRunId: null, source: 'agent', feedback: null },
      { id: 'run-2', agentId: 'calendar', actionType: 'detect-conflict', status: 'completed', createdAt: new Date().toISOString(), workspaceId: 'ws-1', correctionIssued: false, correctionDepth: 0, output: {}, input: {}, correlationId: 'corr-1', updatedAt: new Date().toISOString(), jobId: 'j2', signalId: null, clientId: null, idempotencyKey: null, trustTierAtExecution: null, trustSnapshotId: null, startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), error: null, correctedRunId: null, source: 'agent', feedback: null },
    ],
    initiatorAgentId: overrides.initiatorAgentId ?? 'inbox',
    ...overrides,
  } as any;
}

describe('CoordinationGroupComponent', () => {
  afterEach(() => cleanup());

  it('renders agent count label', () => {
    render(<CoordinationGroupComponent group={buildGroup({ runCount: 3 })} workspaceId="ws-1" />);
    expect(screen.getByText('3-agent coordination')).toBeDefined();
  });

  it('renders agent labels in arrow format', () => {
    render(<CoordinationGroupComponent group={buildGroup()} workspaceId="ws-1" />);
    expect(screen.getByText(/Inbox.*→.*Calendar/)).toBeDefined();
  });

  it('renders initiator label', () => {
    render(<CoordinationGroupComponent group={buildGroup()} workspaceId="ws-1" />);
    expect(screen.getByText(/Initiated/)).toBeDefined();
  });

  it('shows expand button initially', () => {
    render(<CoordinationGroupComponent group={buildGroup()} workspaceId="ws-1" />);
    expect(screen.getByText('Show details')).toBeDefined();
  });

  it('expands to show runs on click', async () => {
    render(<CoordinationGroupComponent group={buildGroup()} workspaceId="ws-1" />);
    await userEvent.click(screen.getByText('Show details'));
    expect(screen.getByText('Collapse')).toBeDefined();
    expect(screen.getAllByTestId('timeline-entry')).toHaveLength(2);
  });

  it('collapses on second click', async () => {
    render(<CoordinationGroupComponent group={buildGroup()} workspaceId="ws-1" />);
    await userEvent.click(screen.getByText('Show details'));
    await userEvent.click(screen.getByText('Collapse'));
    expect(screen.queryAllByTestId('timeline-entry')).toHaveLength(0);
  });

  it('has listitem role', () => {
    render(<CoordinationGroupComponent group={buildGroup()} workspaceId="ws-1" />);
    expect(screen.getByRole('listitem')).toBeDefined();
  });
});
