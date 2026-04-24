import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AgentRunProducer } from '../orchestrator/types';

const ACTIVE_STATUSES = ['queued', 'running', 'waiting_approval', 'completed'];

vi.mock('@flow/db', () => {
  const runs = new Map<string, Record<string, unknown>>();
  return {
    insertRun: vi.fn(async (run: Record<string, unknown>) => {
      runs.set(run.id as string, run);
      return run;
    }),
    findByIdempotencyKey: vi.fn(async (key: string, _wsId: string) => {
      for (const run of runs.values()) {
        if (run.idempotencyKey === key && ACTIVE_STATUSES.includes(run.status as string)) {
          return run;
        }
      }
      return null;
    }),
    updateRunStatus: vi.fn(async (runId: string, status: string, update: Record<string, unknown>) => {
      const run = runs.get(runId);
      if (run) {
        Object.assign(run, { status, ...update });
        return run;
      }
      return { id: runId, status, ...update };
    }),
    getRunsByWorkspace: vi.fn(async () => Array.from(runs.values())),
    getRunById: vi.fn(async (runId: string) => {
      const run = runs.get(runId);
      if (!run) throw new Error(`Run ${runId} not found`);
      return run;
    }),
    claimRunWithGuard: vi.fn(async (runId: string, jobId: string, update: Record<string, unknown>) => {
      const run = runs.get(runId);
      if (!run || run.status !== 'queued' || run.jobId !== jobId) return null;
      Object.assign(run, { status: 'running', ...update });
      return run;
    }),
    releaseRun: vi.fn(),
    findStaleRuns: vi.fn(async () => []),
    __runs: runs,
  };
});

function createFakeBoss() {
  const jobs = new Map<string, { id: string; data: unknown; state: string }>();
  let jobCounter = 0;

  return {
    jobs,
    send: vi.fn(async (_name: string, data: Record<string, unknown>) => {
      const id = `job-${++jobCounter}`;
      jobs.set(id, { id, data, state: 'active' });
      return id;
    }),
    cancel: vi.fn(async (_name: string, id: string) => {
      const job = jobs.get(id);
      if (job) job.state = 'cancelled';
      return { status: 1 };
    }),
    fetch: vi.fn(async () => []),
    complete: vi.fn(async (_name: string, id: string) => {
      const job = jobs.get(id);
      if (job) job.state = 'completed';
      return { status: 1 };
    }),
    fail: vi.fn(async (_name: string, id: string) => {
      const job = jobs.get(id);
      if (job) job.state = 'failed';
      return { status: 1 };
    }),
    getJobById: vi.fn(async () => null),
    start: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    on: vi.fn(),
  };
}

import { PgBossProducer } from '../orchestrator/pg-boss-producer';
import { OrchestratorError } from '../orchestrator/errors';

describe('PgBossProducer', () => {
  let producer: AgentRunProducer;
  let fakeBoss: ReturnType<typeof createFakeBoss>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const db = await import('@flow/db');
    (db as unknown as { __runs: Map<string, Record<string, unknown>> }).__runs.clear();
    fakeBoss = createFakeBoss();
    producer = new PgBossProducer(fakeBoss as unknown as import('pg-boss').PgBoss);
  });

  it('submits a new run and returns handle', async () => {
    const handle = await producer.submit({
      agentId: 'inbox',
      actionType: 'categorize-email',
      input: { workspace_id: '00000000-0000-0000-0000-000000000001', data: 'test' },
      idempotencyKey: 'key-1',
    });
    expect(handle.runId).toBeDefined();
    expect(handle.status).toBe('queued');
    expect(fakeBoss.send).toHaveBeenCalled();
  });

  it('returns existing handle on idempotency fast path', async () => {
    const db = await import('@flow/db');
    const runs = (db as unknown as { __runs: Map<string, Record<string, unknown>> }).__runs;
    runs.set('existing-id', {
      id: 'existing-id',
      workspace_id: '00000000-0000-0000-0000-000000000001',
      agent_id: 'inbox',
      status: 'running',
      idempotencyKey: 'key-dup',
    });
    (db.findByIdempotencyKey as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 'existing-id',
      workspace_id: '00000000-0000-0000-0000-000000000001',
      agent_id: 'inbox',
      status: 'running',
    });

    const handle = await producer.submit({
      agentId: 'inbox',
      actionType: 'categorize-email',
      input: { workspace_id: '00000000-0000-0000-0000-000000000001' },
      idempotencyKey: 'key-dup',
    });
    expect(handle.runId).toBe('existing-id');
    expect(handle.status).toBe('running');
  });

  it('catches TOCTOU race on UNIQUE constraint violation', async () => {
    const db = await import('@flow/db');
    (db.insertRun as ReturnType<typeof vi.fn>).mockRejectedValueOnce({
      code: '23505',
      message: 'duplicate key value violates unique constraint',
    });
    (db.findByIdempotencyKey as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'race-id',
      workspace_id: '00000000-0000-0000-0000-000000000001',
      agent_id: 'inbox',
      status: 'queued',
    });

    const handle = await producer.submit({
      agentId: 'inbox',
      actionType: 'categorize-email',
      input: { workspace_id: '00000000-0000-0000-0000-000000000001' },
      idempotencyKey: 'race-key',
    });
    expect(handle.runId).toBe('race-id');
  });

  it('throws OrchestratorError when boss.send returns null', async () => {
    fakeBoss.send.mockResolvedValueOnce(null as unknown as string);
    await expect(
      producer.submit({
        agentId: 'inbox',
        actionType: 'categorize-email',
        input: { workspace_id: '00000000-0000-0000-0000-000000000001' },
      }),
    ).rejects.toThrow(OrchestratorError);
  });

  it('cancels a queued run', async () => {
    const db = await import('@flow/db');
    (db.getRunById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'run-1',
      agent_id: 'inbox',
      action_type: 'categorize-email',
      job_id: 'job-1',
      status: 'queued',
      workspace_id: '00000000-0000-0000-0000-000000000001',
    });

    await producer.cancel('run-1', 'user requested');
    expect(fakeBoss.cancel).toHaveBeenCalledWith('agent:inbox', 'job-1');
    expect(db.updateRunStatus).toHaveBeenCalledWith('run-1', 'cancelled', expect.objectContaining({
      error: { reason: 'user requested' },
    }));
  });

  it('cancel is a no-op for terminal states', async () => {
    const db = await import('@flow/db');
    (db.getRunById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'run-2',
      agent_id: 'inbox',
      action_type: 'categorize-email',
      job_id: 'job-2',
      status: 'completed',
      workspace_id: '00000000-0000-0000-0000-000000000001',
    });

    await producer.cancel('run-2', 'too late');
    expect(fakeBoss.cancel).not.toHaveBeenCalled();
  });

  it('getStatus returns current run status', async () => {
    const db = await import('@flow/db');
    (db.getRunById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'run-3',
      status: 'running',
    });

    const status = await producer.getStatus('run-3');
    expect(status).toBe('running');
  });

  it('listRuns delegates to getRunsByWorkspace', async () => {
    const db = await import('@flow/db');
    (db.getRunsByWorkspace as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'r1', agent_id: 'inbox', action_type: 'cat', status: 'completed', created_at: '', updated_at: '' },
    ]);

    const runs = await producer.listRuns({
      workspaceId: '00000000-0000-0000-0000-000000000001',
      agentId: 'inbox',
    } as unknown as import('@flow/types').RunListFilter);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.id).toBe('r1');
  });
});
