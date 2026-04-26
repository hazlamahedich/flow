import { vi } from 'vitest';

export function mockApprovalActions() {
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
}
