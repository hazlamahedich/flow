import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TrustClient } from '@flow/trust';
import type { TrustDecision } from '@flow/trust';
import { PgBossWorker } from '../orchestrator/pg-boss-worker';
import { createOutputSchemaRegistry } from '../orchestrator/output-schemas';
import { z } from 'zod';

vi.mock('@flow/db', () => ({
  claimRunWithGuard: vi.fn(),
  updateRunStatus: vi.fn(),
  releaseRun: vi.fn(),
  getRunById: vi.fn(),
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({
      update: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })),
    })),
  })),
}));

vi.mock('../shared/audit-writer', () => ({
  writeAuditLog: vi.fn(),
}));

vi.mock('../orchestrator/gate-events', () => ({
  writeGateSignal: vi.fn(),
}));

const VALID_PAYLOAD = {
  runId: '00000000-0000-0000-0000-000000000001',
  workspaceId: '00000000-0000-0000-0000-000000000002',
  agentId: 'inbox',
  actionType: 'execute',
  input: {},
  clientId: null,
  correlationId: '00000000-0000-0000-0000-000000000003',
};

function makeDecision(overrides: Partial<TrustDecision> = {}): TrustDecision {
  return {
    allowed: true, level: 'auto', reason: 'Trust check passed',
    snapshotId: 'snap-001', preconditionsPassed: true, ...overrides,
  };
}

function makeTrustClient(canActResult: TrustDecision): TrustClient {
  return {
    canAct: vi.fn().mockResolvedValue(canActResult),
    recordSuccess: vi.fn(),
    recordViolation: vi.fn(),
    recordPrecheckFailure: vi.fn(),
    manualOverride: vi.fn(),
  };
}

function createFakeBoss() {
  return {
    fetch: vi.fn(), complete: vi.fn(async () => ({ status: 1 })),
    fail: vi.fn(async () => ({ status: 1 })), cancel: vi.fn(),
    getJobById: vi.fn(), start: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined), on: vi.fn(),
  };
}

describe('Gate fail-safety', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('canAct() throws generic Error → fail-safe supervised', async () => {
    vi.useFakeTimers();
    const tc = makeTrustClient(makeDecision());
    (tc.canAct as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB down'));
    const fakeBoss = createFakeBoss();
    const worker = new PgBossWorker(
      fakeBoss as unknown as import('pg-boss').PgBoss,
      () => undefined, tc, undefined,
    );
    const db = await import('@flow/db');
    fakeBoss.fetch.mockResolvedValue([{ id: 'job-1', data: VALID_PAYLOAD }]);
    (db.claimRunWithGuard as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (db.updateRunStatus as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const claimPromise = worker.claim('inbox');
    await vi.advanceTimersByTimeAsync(22000);
    const handle = await claimPromise;
    expect(handle).toBeNull();
    expect(db.updateRunStatus).toHaveBeenCalledWith(
      VALID_PAYLOAD.runId, 'waiting_approval', expect.anything(),
    );
    vi.useRealTimers();
  });

  it('canAct() returns null → fail-safe supervised', async () => {
    vi.useFakeTimers();
    const tc = makeTrustClient(makeDecision());
    (tc.canAct as ReturnType<typeof vi.fn>).mockResolvedValue(null as unknown as TrustDecision);
    const fakeBoss = createFakeBoss();
    const worker = new PgBossWorker(
      fakeBoss as unknown as import('pg-boss').PgBoss,
      () => undefined, tc, undefined,
    );
    const db = await import('@flow/db');
    fakeBoss.fetch.mockResolvedValue([{ id: 'job-1', data: VALID_PAYLOAD }]);
    (db.claimRunWithGuard as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (db.updateRunStatus as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const claimPromise = worker.claim('inbox');
    await vi.advanceTimersByTimeAsync(22000);
    const handle = await claimPromise;
    expect(handle).toBeNull();
    vi.useRealTimers();
  });

  it('canAct() returns object without `allowed` field → fail-safe', async () => {
    vi.useFakeTimers();
    const tc = makeTrustClient(makeDecision());
    (tc.canAct as ReturnType<typeof vi.fn>).mockResolvedValue({ level: 'auto' } as unknown as TrustDecision);
    const fakeBoss = createFakeBoss();
    const worker = new PgBossWorker(
      fakeBoss as unknown as import('pg-boss').PgBoss,
      () => undefined, tc, undefined,
    );
    const db = await import('@flow/db');
    fakeBoss.fetch.mockResolvedValue([{ id: 'job-1', data: VALID_PAYLOAD }]);
    (db.claimRunWithGuard as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (db.updateRunStatus as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const claimPromise = worker.claim('inbox');
    await vi.advanceTimersByTimeAsync(22000);
    const handle = await claimPromise;
    expect(handle).toBeNull();
    vi.useRealTimers();
  });

  it('Worker without trustClient → logs WARN once, processes normally', async () => {
    const fakeBoss = createFakeBoss();
    const worker = new PgBossWorker(
      fakeBoss as unknown as import('pg-boss').PgBoss,
      () => undefined,
    );
    const db = await import('@flow/db');
    fakeBoss.fetch.mockResolvedValue([{ id: 'job-1', data: VALID_PAYLOAD }]);
    (db.claimRunWithGuard as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const handle = await worker.claim('inbox');
    expect(handle).toEqual({ runId: VALID_PAYLOAD.runId, status: 'running' });
  });

  it('Worker without trustClient → second job no WARN log', async () => {
    const fakeBoss = createFakeBoss();
    const worker = new PgBossWorker(
      fakeBoss as unknown as import('pg-boss').PgBoss,
      () => undefined,
    );
    const db = await import('@flow/db');
    fakeBoss.fetch.mockResolvedValue([{ id: 'job-1', data: VALID_PAYLOAD }]);
    (db.claimRunWithGuard as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    await worker.claim('inbox');
    const audit = await import('../shared/audit-writer');
    const warnCount = (audit.writeAuditLog as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: unknown[]) => (c[0] as Record<string, unknown>).action === 'gate.not_configured',
    ).length;
    expect(warnCount).toBe(1);
  });

  it('recordViolation() throws on crash-retry → no double penalty', async () => {
    const tc = makeTrustClient(makeDecision());
    const { TrustTransitionError } = await import('@flow/trust');
    (tc.recordViolation as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new TrustTransitionError('CONCURRENT_MODIFICATION', 'CAS failed', { retryable: false });
    });
    const registry = createOutputSchemaRegistry();
    registry.register('inbox', 'execute', z.object({ result: z.string() }));
    const fakeBoss = createFakeBoss();
    const worker = new PgBossWorker(
      fakeBoss as unknown as import('pg-boss').PgBoss,
      () => undefined, tc, registry,
    );
    const db = await import('@flow/db');
    (db.getRunById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'run-1', agent_id: 'inbox', job_id: 'job-1', workspace_id: 'ws-1',
      action_type: 'execute', trust_snapshot_id: 'snap-001',
    });
    (db.updateRunStatus as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await worker.complete('run-1', { output: { bad: true } });
    expect(db.updateRunStatus).toHaveBeenCalledWith('run-1', 'failed', expect.anything());
  });

  it('Backward compat: old tests pass without any trust config', async () => {
    const fakeBoss = createFakeBoss();
    const worker = new PgBossWorker(
      fakeBoss as unknown as import('pg-boss').PgBoss,
      () => undefined,
    );
    const db = await import('@flow/db');
    fakeBoss.fetch.mockResolvedValue([{ id: 'job-1', data: VALID_PAYLOAD }]);
    (db.claimRunWithGuard as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (db.getRunById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'run-1', agent_id: 'inbox', job_id: 'job-1', workspace_id: 'ws-1',
    });
    (db.updateRunStatus as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const handle = await worker.claim('inbox');
    expect(handle).not.toBeNull();
    await worker.complete('run-1', { output: { result: 'done' } });
    expect(db.updateRunStatus).toHaveBeenCalledWith('run-1', 'completed', expect.anything());
  });
});
