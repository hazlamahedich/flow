import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CorrectionButton } from '../correction-button';

vi.mock('../../actions/correction-actions', () => ({
  issueCorrection: vi.fn().mockResolvedValue({ success: true, data: { correctedRunId: 'run-corrected' } }),
}));

function buildEntry(overrides: Partial<{
  id: string;
  correctionIssued: boolean;
  correctionDepth: number;
  output: Record<string, unknown>;
  error: Record<string, unknown> | null;
}> = {}) {
  return {
    id: overrides.id ?? 'run-1',
    workspaceId: 'ws-1',
    agentId: 'inbox' as const,
    actionType: 'categorize-email',
    status: 'completed' as const,
    input: {},
    output: overrides.output ?? { category: 'invoice' },
    correlationId: 'corr-1',
    createdAt: new Date('2026-01-01T12:00:00Z').toISOString(),
    updatedAt: new Date('2026-01-01T12:00:00Z').toISOString(),
    jobId: 'job-1',
    signalId: null,
    clientId: null,
    idempotencyKey: null,
    trustTierAtExecution: null,
    trustSnapshotId: null,
    startedAt: new Date('2026-01-01T12:00:00Z').toISOString(),
    completedAt: new Date('2026-01-01T12:00:00Z').toISOString(),
    error: overrides.error ?? null,
    correctedRunId: null,
    correctionDepth: overrides.correctionDepth ?? 0,
    correctionIssued: overrides.correctionIssued ?? false,
    source: 'agent' as const,
    feedback: null,
  };
}

describe('CorrectionButton', () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it('returns null when correction already issued', () => {
    const { container } = render(<CorrectionButton entry={buildEntry({ correctionIssued: true })} />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null when correction depth >= 5', () => {
    const { container } = render(<CorrectionButton entry={buildEntry({ correctionDepth: 5 })} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders issue correction button', () => {
    render(<CorrectionButton entry={buildEntry()} />);
    expect(screen.getByText('Issue correction')).toBeDefined();
  });

  it('shows form on button click', async () => {
    render(<CorrectionButton entry={buildEntry()} />);
    await userEvent.click(screen.getByText('Issue correction'));
    expect(screen.getByText('Correct agent output')).toBeDefined();
    expect(screen.getByText('Send correction')).toBeDefined();
  });

  it('hides form on cancel', async () => {
    render(<CorrectionButton entry={buildEntry()} />);
    await userEvent.click(screen.getByText('Issue correction'));
    await userEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Correct agent output')).toBeNull();
    expect(screen.getByText('Issue correction')).toBeDefined();
  });
});
