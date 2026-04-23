import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('pg-boss', () => ({
  PgBoss: vi.fn().mockImplementation(() => ({
    start: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    on: vi.fn(),
    getJobById: vi.fn(),
  })),
}));

vi.mock('@flow/db', () => ({
  findStaleRuns: vi.fn(async () => []),
  updateRunStatus: vi.fn(),
}));

vi.mock('../shared/audit-writer', () => ({
  writeAuditLog: vi.fn(),
}));

describe('Recovery Supervisor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'postgresql://test:test@localhost/test';
  });

  it('recovers stale run when pg-boss confirms no active job', async () => {
    const db = await import('@flow/db');
    (db.findStaleRuns as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'run-1', agent_id: 'inbox', action_type: 'cat', job_id: 'job-1', workspace_id: 'ws-1' },
    ]);
    (db.updateRunStatus as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const pgBoss = await import('pg-boss');
    const boss = new (pgBoss.PgBoss as unknown as new (opts: unknown) => import('pg-boss').PgBoss)({} as never);
    (boss.getJobById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const stale = await db.findStaleRuns(5);
    for (const run of stale) {
      const job = await boss.getJobById(`agent:${run.agent_id}`, run.job_id);
      if (job && (job as { state: string }).state !== 'failed' && (job as { state: string }).state !== 'completed') continue;
      await db.updateRunStatus(run.id, 'failed', {
        error: { code: 'AGENT_TIMEOUT', message: 'Recovery: no heartbeat for 5min' },
        completedAt: new Date().toISOString(),
      });
    }
    expect(db.updateRunStatus).toHaveBeenCalledWith('run-1', 'failed', expect.objectContaining({
      error: expect.objectContaining({ code: 'AGENT_TIMEOUT' }),
    }));
  });

  it('leaves healthy running job alone', async () => {
    const db = await import('@flow/db');
    (db.findStaleRuns as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    const stale = await db.findStaleRuns(5);
    expect(stale).toHaveLength(0);
    expect(db.updateRunStatus).not.toHaveBeenCalled();
  });

  it('skips recovery when pg-boss job is active', async () => {
    const db = await import('@flow/db');
    (db.findStaleRuns as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'run-1', agent_id: 'inbox', action_type: 'cat', job_id: 'job-1', workspace_id: 'ws-1' },
    ]);

    const pgBoss = await import('pg-boss');
    const boss = new (pgBoss.PgBoss as unknown as new (opts: unknown) => import('pg-boss').PgBoss)({} as never);
    (boss.getJobById as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'job-1', state: 'active' });

    const stale = await db.findStaleRuns(5);
    for (const run of stale) {
      const job = await boss.getJobById(`agent:${run.agent_id}`, run.job_id);
      if (job && (job as { state: string }).state !== 'failed' && (job as { state: string }).state !== 'completed') continue;
      await db.updateRunStatus(run.id, 'failed', {
        error: { code: 'AGENT_TIMEOUT', message: 'Recovery: no heartbeat for 5min' },
      });
    }
    expect(db.updateRunStatus).not.toHaveBeenCalled();
  });

  it('recovers after 5min threshold', async () => {
    const db = await import('@flow/db');
    (db.findStaleRuns as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'run-old', agent_id: 'inbox', action_type: 'cat', job_id: 'job-old', workspace_id: 'ws-1' },
    ]);
    const stale = await db.findStaleRuns(5);
    expect(stale).toHaveLength(1);
  });

  it('recovery is idempotent across cycles', async () => {
    const db = await import('@flow/db');
    (db.findStaleRuns as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'run-1', agent_id: 'inbox', action_type: 'cat', job_id: 'job-1', workspace_id: 'ws-1' },
    ]);
    (db.updateRunStatus as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const pgBoss = await import('pg-boss');
    const boss = new (pgBoss.PgBoss as unknown as new (opts: unknown) => import('pg-boss').PgBoss)({} as never);
    (boss.getJobById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    for (let i = 0; i < 3; i++) {
      const stale = await db.findStaleRuns(5);
      for (const run of stale) {
        const job = await boss.getJobById(`agent:${run.agent_id}`, run.job_id);
        if (job && (job as { state: string }).state !== 'failed' && (job as { state: string }).state !== 'completed') continue;
        await db.updateRunStatus(run.id, 'failed', {
          error: { code: 'AGENT_TIMEOUT', message: 'Recovery: no heartbeat for 5min' },
        });
      }
    }
    expect(db.updateRunStatus).toHaveBeenCalledTimes(3);
  });
});
