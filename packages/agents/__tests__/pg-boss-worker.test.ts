import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AgentRunWorker } from '../orchestrator/types';
import type { AgentId, FlowError } from '@flow/types';
import { CircuitBreaker } from '../shared/circuit-breaker';

vi.mock('@flow/db', () => ({
  claimRunWithGuard: vi.fn(),
  updateRunStatus: vi.fn(),
  releaseRun: vi.fn(),
  getRunById: vi.fn(),
}));

vi.mock('../shared/audit-writer', () => ({
  writeAuditLog: vi.fn(),
}));

const VALID_PAYLOAD = {
  runId: '00000000-0000-0000-0000-000000000001',
  workspaceId: '00000000-0000-0000-0000-000000000002',
  agentId: 'inbox',
  actionType: 'categorize-email',
  input: {},
  clientId: null,
  correlationId: '00000000-0000-0000-0000-000000000003',
};

function createFakeBoss() {
  return {
    fetch: vi.fn(),
    complete: vi.fn(async () => ({ status: 1 })),
    fail: vi.fn(async () => ({ status: 1 })),
    cancel: vi.fn(),
    getJobById: vi.fn(),
    start: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    on: vi.fn(),
  };
}

import { PgBossWorker } from '../orchestrator/pg-boss-worker';

describe('PgBossWorker', () => {
  let worker: AgentRunWorker;
  let fakeBoss: ReturnType<typeof createFakeBoss>;
  let breakers: Map<string, CircuitBreaker>;

  beforeEach(() => {
    vi.clearAllMocks();
    fakeBoss = createFakeBoss();
    breakers = new Map();
    worker = new PgBossWorker(
      fakeBoss as unknown as import('pg-boss').PgBoss,
      (agentId: AgentId) => breakers.get(agentId),
    );
  });

  it('claims a job and returns handle', async () => {
    fakeBoss.fetch.mockResolvedValue([{ id: 'job-1', data: VALID_PAYLOAD }]);
    const db = await import('@flow/db');
    (db.claimRunWithGuard as ReturnType<typeof vi.fn>).mockResolvedValue({ id: VALID_PAYLOAD.runId, status: 'running' });

    const handle = await worker.claim('inbox');
    expect(handle).toEqual({ runId: VALID_PAYLOAD.runId, status: 'running' });
  });

  it('returns null on empty queue', async () => {
    fakeBoss.fetch.mockResolvedValue([]);
    const handle = await worker.claim('inbox');
    expect(handle).toBeNull();
  });

  it('returns null when WHERE guard matches 0 rows (claim already taken)', async () => {
    fakeBoss.fetch.mockResolvedValue([{ id: 'job-1', data: VALID_PAYLOAD }]);
    const db = await import('@flow/db');
    (db.claimRunWithGuard as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const handle = await worker.claim('inbox');
    expect(handle).toBeNull();
    expect(db.releaseRun).not.toHaveBeenCalled();
  });

  it('completes a run', async () => {
    const db = await import('@flow/db');
    (db.getRunById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'run-1', agent_id: 'inbox', job_id: 'job-1', workspace_id: 'ws-1',
    });
    (db.updateRunStatus as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await worker.complete('run-1', { output: { result: 'done' } });
    expect(fakeBoss.complete).toHaveBeenCalledWith('agent:inbox', 'job-1');
    expect(db.updateRunStatus).toHaveBeenCalledWith('run-1', 'completed', expect.objectContaining({
      output: { result: 'done' },
    }));
  });

  it('defers to pg-boss for retryable errors', async () => {
    const db = await import('@flow/db');
    (db.getRunById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'run-1', agent_id: 'inbox', job_id: 'job-1', workspace_id: 'ws-1',
    });

    const error: FlowError = {
      status: 500, code: 'AGENT_ERROR', message: 'retry me',
      category: 'agent', agentType: 'inbox', retryable: true,
    };
    await worker.fail('run-1', error);
    expect(fakeBoss.fail).not.toHaveBeenCalled();
    expect(db.updateRunStatus).not.toHaveBeenCalled();
  });

  it('fails non-retryable error', async () => {
    const db = await import('@flow/db');
    (db.getRunById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'run-1', agent_id: 'inbox', job_id: 'job-1', workspace_id: 'ws-1',
    });
    (db.updateRunStatus as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const error: FlowError = {
      status: 500, code: 'AGENT_ERROR', message: 'fatal',
      category: 'agent', agentType: 'inbox', retryable: false,
    };
    await worker.fail('run-1', error);
    expect(fakeBoss.fail).toHaveBeenCalledWith('agent:inbox', 'job-1', error);
    expect(db.updateRunStatus).toHaveBeenCalledWith('run-1', 'failed', expect.objectContaining({
      error: expect.objectContaining({ retryExhausted: false }),
    }));
  });

  it('proposes transitions to waiting_approval', async () => {
    const db = await import('@flow/db');
    (db.updateRunStatus as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await worker.propose('run-1', {
      title: 'Draft Response',
      confidence: 0.9,
      riskLevel: 'low',
      reasoning: 'Looks good',
    });
    expect(db.updateRunStatus).toHaveBeenCalledWith('run-1', 'waiting_approval', expect.objectContaining({
      output: expect.objectContaining({ title: 'Draft Response' }),
    }));
  });

  it('records success on circuit breaker when completing', async () => {
    const db = await import('@flow/db');
    (db.getRunById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'run-1', agent_id: 'inbox', job_id: 'job-1', workspace_id: 'ws-1',
    });
    (db.updateRunStatus as ReturnType<typeof vi.fn>).mockResolvedValue({});
    const cb = new CircuitBreaker();
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    cb.recordFailure();
    breakers.set('inbox', cb);

    await worker.complete('run-1', { output: {} });
    expect(cb.state.state).toBe('closed');
  });

  it('records failure on circuit breaker when failing', async () => {
    const db = await import('@flow/db');
    (db.getRunById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'run-1', agent_id: 'inbox', job_id: 'job-1', workspace_id: 'ws-1',
    });
    (db.updateRunStatus as ReturnType<typeof vi.fn>).mockResolvedValue({});
    const cb = new CircuitBreaker();
    breakers.set('inbox', cb);

    const error: FlowError = {
      status: 500, code: 'AGENT_ERROR', message: 'fatal',
      category: 'agent', agentType: 'inbox', retryable: false,
    };
    await worker.fail('run-1', error);
    expect(cb.state.failures).toBe(1);
  });

  it.skip('should handle pg-boss re-offering a retryable job without claim-guard loop', async () => {
    // TODO(deferred): When boss.fail() is called for retryable errors, pg-boss
    // re-offers the same job. The worker re-claims it but the claim guard
    // rejects (status already 'running'). Expected: worker should not
    // release the run back to 'queued', creating an infinite loop.
    // This test documents the expected behavior for when we implement
    // explicit retry via boss.fail() (deferred until integration test harness exists).
  });
});
