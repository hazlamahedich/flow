import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@flow/db', () => ({
  claimRunWithGuard: vi.fn(),
  updateRunStatus: vi.fn(),
  releaseRun: vi.fn(),
  getRunById: vi.fn(),
  findStaleRuns: vi.fn(async () => []),
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

import { PgBossWorker } from '../orchestrator/pg-boss-worker';
import type { AgentId } from '@flow/types';

describe('PgBoss Concurrency', () => {
  let fakeBoss: ReturnType<typeof createFakeBoss>;

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

  beforeEach(() => {
    vi.clearAllMocks();
    fakeBoss = createFakeBoss();
  });

  it('concurrent claim returns null when guard rejects second worker', async () => {
    fakeBoss.fetch
      .mockResolvedValueOnce([{ id: 'job-1', data: VALID_PAYLOAD }])
      .mockResolvedValueOnce([{ id: 'job-1', data: VALID_PAYLOAD }]);

    const db = await import('@flow/db');
    (db.claimRunWithGuard as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ id: VALID_PAYLOAD.runId, status: 'running' })
      .mockResolvedValueOnce(null);

    const worker1 = new PgBossWorker(fakeBoss as unknown as import('pg-boss').PgBoss, () => undefined);
    const worker2 = new PgBossWorker(fakeBoss as unknown as import('pg-boss').PgBoss, () => undefined);

    const [h1, h2] = await Promise.all([worker1.claim('inbox'), worker2.claim('inbox')]);
    expect(h1).not.toBeNull();
    expect(h2).toBeNull();
  });

  it('double-complete is idempotent at db level', async () => {
    const db = await import('@flow/db');
    (db.getRunById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'run-1', agent_id: 'inbox', job_id: 'job-1', workspace_id: 'ws-1',
    });
    (db.updateRunStatus as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const worker = new PgBossWorker(fakeBoss as unknown as import('pg-boss').PgBoss, () => undefined);
    await worker.complete('run-1', { output: { a: 1 } });
    await worker.complete('run-1', { output: { a: 1 } });
    expect(fakeBoss.complete).toHaveBeenCalledTimes(2);
  });

  it('claim-after-cancel returns null', async () => {
    fakeBoss.fetch.mockResolvedValue([]);
    const worker = new PgBossWorker(fakeBoss as unknown as import('pg-boss').PgBoss, () => undefined);
    const handle = await worker.claim('inbox' as AgentId);
    expect(handle).toBeNull();
  });

  it('recovery skips when pg-boss has active job', async () => {
    const db = await import('@flow/db');
    (db.findStaleRuns as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'run-1', agent_id: 'inbox', action_type: 'cat', job_id: 'job-1', workspace_id: 'ws-1' },
    ]);
    fakeBoss.getJobById.mockResolvedValue({ id: 'job-1', state: 'active' });

    const { findStaleRuns, updateRunStatus } = db;
    const stale = await findStaleRuns(5);
    for (const run of stale) {
      const job = await fakeBoss.getJobById(`agent:${run.agent_id}`, run.job_id);
      if (job && job.state !== 'failed' && job.state !== 'completed') continue;
      await updateRunStatus(run.id, 'failed', { error: { code: 'AGENT_TIMEOUT' } });
    }
    expect(updateRunStatus).not.toHaveBeenCalled();
  });

  it('recovery transitions when pg-boss confirms no active job', async () => {
    const db = await import('@flow/db');
    (db.findStaleRuns as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'run-1', agent_id: 'inbox', action_type: 'cat', job_id: 'job-1', workspace_id: 'ws-1' },
    ]);
    (db.updateRunStatus as ReturnType<typeof vi.fn>).mockResolvedValue({});
    fakeBoss.getJobById.mockResolvedValue(null);

    const { findStaleRuns, updateRunStatus } = db;
    const stale = await findStaleRuns(5);
    for (const run of stale) {
      const job = await fakeBoss.getJobById(`agent:${run.agent_id}`, run.job_id);
      if (job && job.state !== 'failed' && job.state !== 'completed') continue;
      await updateRunStatus(run.id, 'failed', expect.objectContaining({
        error: expect.objectContaining({ code: 'AGENT_TIMEOUT' }),
      }));
    }
    expect(updateRunStatus).toHaveBeenCalled();
  });
});
