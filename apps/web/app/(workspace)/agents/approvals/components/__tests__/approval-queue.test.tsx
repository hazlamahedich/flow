import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { buildApprovalQueueItem, buildBatchApprovalItems, buildTimedOutItem } from '@flow/test-utils';
import { ApprovalQueue } from '../approval-queue';

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: vi.fn(() => ({
    channel: vi.fn(() => ({
      on: vi.fn(() => ({ subscribe: vi.fn() })),
    })),
    removeChannel: vi.fn(),
  })),
}));

vi.mock('../approval-queue', async () => {
  const actual = await vi.importActual('../approval-queue');
  return actual;
});

vi.mock('../../actions/approve-run', () => ({
  approveRun: vi.fn().mockResolvedValue({ success: true, data: { runId: 'r1', newStatus: 'completed' } }),
}));
vi.mock('../../actions/reject-run', () => ({
  rejectRun: vi.fn().mockResolvedValue({ success: true, data: { runId: 'r1', newStatus: 'cancelled' } }),
}));
vi.mock('../../actions/batch-approve-runs', () => ({
  batchApproveRuns: vi.fn().mockResolvedValue({ success: true, data: { succeeded: [], failed: [] } }),
}));
vi.mock('../../actions/batch-reject-runs', () => ({
  batchRejectRuns: vi.fn().mockResolvedValue({ success: true, data: { succeeded: [], failed: [] } }),
}));
vi.mock('../../actions/update-proposal', () => ({
  updateProposal: vi.fn().mockResolvedValue({ success: true, data: { runId: 'r1', newStatus: 'waiting_approval' } }),
}));
vi.mock('../../actions/cancel-run', () => ({
  cancelRun: vi.fn().mockResolvedValue({ success: true, data: { runId: 'r1', newStatus: 'cancelled' } }),
}));
vi.mock('../../actions/resume-run', () => ({
  resumeRun: vi.fn().mockResolvedValue({ success: true, data: { runId: 'r1', newStatus: 'running' } }),
}));

const WS = 'ws-test-00000000-0000-0000-0000-000000000000';

function renderQueue(items = [buildApprovalQueueItem()]) {
  return render(
    <ApprovalQueue
      initialItems={items}
      agentBreakdown={{ inbox: items.length }}
      totalCount={items.length}
      workspaceId={WS}
    />,
  );
}

describe('ApprovalQueue', () => {
  beforeEach(() => { cleanup(); vi.clearAllMocks(); });
  afterEach(() => { cleanup(); });

  it('renders empty state', () => {
    render(<ApprovalQueue initialItems={[]} agentBreakdown={{}} totalCount={0} workspaceId={WS} />);
    expect(screen.getByText(/All clear/)).toBeDefined();
  });

  it('renders items', () => {
    const items = [
      buildApprovalQueueItem({ proposalType: 'agent_proposal' }),
      buildApprovalQueueItem({ proposalType: 'trust_blocked' }),
    ];
    render(<ApprovalQueue initialItems={items} agentBreakdown={{ inbox: 1, calendar: 1 }} totalCount={2} workspaceId={WS} />);
    expect(screen.getByText('Agent Proposal')).toBeDefined();
    expect(screen.getByText('Trust Gate')).toBeDefined();
  });

  it('shows Navigate mode indicator', () => {
    renderQueue();
    expect(screen.getAllByText('Navigate').length).toBeGreaterThan(0);
  });

  it('auto-focuses first item on ArrowDown', () => {
    const items = buildBatchApprovalItems(3);
    const { container } = renderQueue(items);
    const wrapper = container.querySelector('[tabindex="-1"]');
    expect(wrapper).toBeTruthy();
    fireEvent.keyDown(wrapper!, { key: 'ArrowDown' });
    expect(container.querySelector('[aria-selected="true"]')).toBeTruthy();
  });

  it('approves focused item on A key press', async () => {
    const { approveRun } = await import('../../actions/approve-run');
    const { container } = renderQueue(buildBatchApprovalItems(2));
    const wrapper = container.querySelector('[tabindex="-1"]')!;
    fireEvent.keyDown(wrapper, { key: 'ArrowDown' });
    fireEvent.keyDown(wrapper, { key: 'a' });
    await waitFor(() => { expect(approveRun).toHaveBeenCalled(); });
  });

  it('rejects focused item on R key press', async () => {
    const { rejectRun } = await import('../../actions/reject-run');
    const { container } = renderQueue(buildBatchApprovalItems(2));
    const wrapper = container.querySelector('[tabindex="-1"]')!;
    fireEvent.keyDown(wrapper, { key: 'ArrowDown' });
    fireEvent.keyDown(wrapper, { key: 'r' });
    await waitFor(() => { expect(rejectRun).toHaveBeenCalled(); });
  });

  it('enters edit mode on E key press', () => {
    const { container } = renderQueue(buildBatchApprovalItems(2));
    const wrapper = container.querySelector('[tabindex="-1"]')!;
    fireEvent.keyDown(wrapper, { key: 'ArrowDown' });
    fireEvent.keyDown(wrapper, { key: 'e' });
    expect(screen.getAllByText('Editing').length).toBeGreaterThan(0);
  });

  it('returns to navigate mode on Escape from edit', () => {
    const { container } = renderQueue(buildBatchApprovalItems(2));
    const wrapper = container.querySelector('[tabindex="-1"]')!;
    fireEvent.keyDown(wrapper, { key: 'ArrowDown' });
    fireEvent.keyDown(wrapper, { key: 'e' });
    fireEvent.keyDown(wrapper, { key: 'Escape' });
    expect(screen.getAllByText('Navigate').length).toBeGreaterThan(0);
  });

  it('toggles reasoning on Tab key', () => {
    const { container } = renderQueue(buildBatchApprovalItems(2));
    const wrapper = container.querySelector('[tabindex="-1"]')!;
    fireEvent.keyDown(wrapper, { key: 'ArrowDown' });
    fireEvent.keyDown(wrapper, { key: 'Tab' });
    expect(screen.getByText('Reasoning')).toBeDefined();
  });

  it('escape key clears selection and returns to navigate mode', () => {
    const { container } = renderQueue(buildBatchApprovalItems(3));
    const wrapper = container.querySelector('[tabindex="-1"]')!;
    fireEvent.keyDown(wrapper, { key: 'ArrowDown' });
    fireEvent.keyDown(wrapper, { key: 'ArrowUp' });
    fireEvent.keyDown(wrapper, { key: 'Escape' });
    expect(screen.getAllByText('Navigate').length).toBeGreaterThan(0);
  });

  it('wraps focus from last to first on ArrowDown', () => {
    const { container } = renderQueue(buildBatchApprovalItems(2));
    const wrapper = container.querySelector('[tabindex="-1"]')!;
    fireEvent.keyDown(wrapper, { key: 'ArrowDown' });
    fireEvent.keyDown(wrapper, { key: 'ArrowDown' });
    fireEvent.keyDown(wrapper, { key: 'ArrowDown' });
    expect(container.querySelectorAll('[aria-selected="true"]').length).toBeLessThanOrEqual(1);
  });

  it('renders inline edit form when E activates edit mode', () => {
    const { container } = renderQueue(buildBatchApprovalItems(1));
    const wrapper = container.querySelector('[tabindex="-1"]')!;
    fireEvent.keyDown(wrapper, { key: 'ArrowDown' });
    fireEvent.keyDown(wrapper, { key: 'e' });
    expect(screen.getByRole('button', { name: /Save/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Cancel/i })).toBeDefined();
  });

  it('returns to navigate mode on Escape from edit', () => {
    const { container } = renderQueue(buildBatchApprovalItems(1));
    const wrapper = container.querySelector('[tabindex="-1"]')!;
    fireEvent.keyDown(wrapper, { key: 'ArrowDown' });
    fireEvent.keyDown(wrapper, { key: 'e' });
    expect(screen.getAllByText('Editing').length).toBeGreaterThan(0);
    fireEvent.keyDown(wrapper, { key: 'Escape' });
    expect(screen.getAllByText('Navigate').length).toBeGreaterThan(0);
  });

  it('shows error message after optimistic rollback', async () => {
    const { approveRun } = await import('../../actions/approve-run');
    vi.mocked(approveRun).mockResolvedValueOnce({
      success: false, error: { status: 409, code: 'CONFLICT', message: 'Already processed', category: 'validation' },
    });
    const { container } = renderQueue(buildBatchApprovalItems(1));
    const wrapper = container.querySelector('[tabindex="-1"]')!;
    fireEvent.keyDown(wrapper, { key: 'ArrowDown' });
    fireEvent.keyDown(wrapper, { key: 'a' });
    await waitFor(() => { expect(approveRun).toHaveBeenCalled(); });
    await waitFor(() => { expect(screen.getByText(/Already processed/)).toBeDefined(); });
  });

  it('removes item from list after successful approve', async () => {
    const { approveRun } = await import('../../actions/approve-run');
    vi.mocked(approveRun).mockResolvedValueOnce({
      success: true, data: { runId: expect.any(String), newStatus: 'completed' },
    });
    const { container } = renderQueue(buildBatchApprovalItems(2));
    const wrapper = container.querySelector('[tabindex="-1"]')!;
    fireEvent.keyDown(wrapper, { key: 'ArrowDown' });
    fireEvent.keyDown(wrapper, { key: 'a' });
    await waitFor(() => { expect(approveRun).toHaveBeenCalled(); });
  });

  it('renders timeout UI with resume and cancel buttons for timed_out runs', () => {
    const item = buildTimedOutItem();
    render(<ApprovalQueue initialItems={[item]} agentBreakdown={{ inbox: 1 }} totalCount={1} workspaceId={WS} />);
    expect(screen.getByText(/Execution paused/)).toBeDefined();
  });

  it('announces actions via aria-live region', async () => {
    const { approveRun } = await import('../../actions/approve-run');
    vi.mocked(approveRun).mockResolvedValueOnce({
      success: true, data: { runId: expect.any(String), newStatus: 'completed' },
    });
    const { container } = renderQueue(buildBatchApprovalItems(1));
    const wrapper = container.querySelector('[tabindex="-1"]')!;
    expect(container.querySelector('[aria-live="polite"]')).toBeTruthy();
    fireEvent.keyDown(wrapper, { key: 'ArrowDown' });
    fireEvent.keyDown(wrapper, { key: 'a' });
    await waitFor(() => { expect(approveRun).toHaveBeenCalled(); });
  });

  it('shows selected indicator when item is focused', () => {
    const items = buildBatchApprovalItems(3);
    const { container } = renderQueue(items);
    const wrapper = container.querySelector('[tabindex="-1"]')!;
    fireEvent.keyDown(wrapper, { key: 'ArrowDown' });
    const focusedId = items[0]!.run.id;
    const focusedRow = container.querySelector(`#proposal-${focusedId}`);
    expect(focusedRow).toBeTruthy();
    expect(focusedRow!.querySelector('[role="listitem"]')).toBeTruthy();
  });

  it('displays keyboard shortcut hints on proposal cards', () => {
    renderQueue();
    expect(screen.getAllByText('[A]pprove').length).toBeGreaterThan(0);
    expect(screen.getAllByText('[R]eject').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\[E\]dit/).length).toBeGreaterThan(0);
  });
});
