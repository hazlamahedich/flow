import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TrustClient, TrustDecision } from '@flow/trust';
import { PgBossWorker } from '../orchestrator/pg-boss-worker';
import { createOutputSchemaRegistry, registerMvpSchemas } from '../orchestrator/output-schemas';
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

function makeTrustClient(decision: TrustDecision): TrustClient {
  return {
    canAct: vi.fn().mockResolvedValue(decision),
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

describe('Gate integration', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('full pipeline: claim → pre-check pass → execute → post-check pass → complete', async () => {
    const tc = makeTrustClient(makeDecision({ allowed: true, level: 'auto', preconditionsPassed: true }));
    const registry = createOutputSchemaRegistry();
    registry.register('inbox', 'execute', z.object({ result: z.string() }));
    const fakeBoss = createFakeBoss();
    const worker = new PgBossWorker(
      fakeBoss as unknown as import('pg-boss').PgBoss, () => undefined, tc, registry,
    );
    const db = await import('@flow/db');
    fakeBoss.fetch.mockResolvedValue([{ id: 'job-1', data: VALID_PAYLOAD }]);
    (db.claimRunWithGuard as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (db.getRunById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: VALID_PAYLOAD.runId, agent_id: 'inbox', job_id: 'job-1',
      workspace_id: VALID_PAYLOAD.workspaceId, action_type: 'execute',
      trust_snapshot_id: 'snap-001',
    });
    (db.updateRunStatus as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const handle = await worker.claim('inbox');
    expect(handle).toEqual({ runId: VALID_PAYLOAD.runId, status: 'running' });
    await worker.complete(VALID_PAYLOAD.runId, { output: { result: 'done' } });
    expect(db.updateRunStatus).toHaveBeenCalledWith(VALID_PAYLOAD.runId, 'completed', expect.anything());
  });

  it('full pipeline: claim → pre-check fail → fail with AGENT_PRECHECK_FAILED', async () => {
    const tc = makeTrustClient(makeDecision({
      allowed: false, preconditionsPassed: false, failedPreconditionKey: 'email',
    }));
    const fakeBoss = createFakeBoss();
    const worker = new PgBossWorker(
      fakeBoss as unknown as import('pg-boss').PgBoss, () => undefined, tc, undefined,
    );
    const db = await import('@flow/db');
    fakeBoss.fetch.mockResolvedValue([{ id: 'job-1', data: VALID_PAYLOAD }]);
    (db.claimRunWithGuard as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (db.getRunById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: VALID_PAYLOAD.runId, agent_id: 'inbox', job_id: 'job-1',
      workspace_id: VALID_PAYLOAD.workspaceId, action_type: 'execute',
    });
    (db.updateRunStatus as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const handle = await worker.claim('inbox');
    expect(handle).toBeNull();
    const failCalls = (db.updateRunStatus as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: unknown[]) => c[1] === 'failed',
    );
    expect(failCalls.length).toBe(1);
    const errorObj = failCalls[0]?.[2] as Record<string, unknown> | undefined;
    expect(errorObj?.error).toHaveProperty('code', 'AGENT_PRECHECK_FAILED');
  });

  it('full pipeline: claim → pre-check pass → execute → post-check fail → AGENT_OUTPUT_REJECTED', async () => {
    const tc = makeTrustClient(makeDecision({ allowed: true, level: 'auto', preconditionsPassed: true }));
    const registry = createOutputSchemaRegistry();
    registry.register('inbox', 'execute', z.object({ result: z.string() }));
    const fakeBoss = createFakeBoss();
    const worker = new PgBossWorker(
      fakeBoss as unknown as import('pg-boss').PgBoss, () => undefined, tc, registry,
    );
    const db = await import('@flow/db');
    fakeBoss.fetch.mockResolvedValue([{ id: 'job-1', data: VALID_PAYLOAD }]);
    (db.claimRunWithGuard as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (db.getRunById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: VALID_PAYLOAD.runId, agent_id: 'inbox', job_id: 'job-1',
      workspace_id: VALID_PAYLOAD.workspaceId, action_type: 'execute',
      trust_snapshot_id: 'snap-001',
    });
    (db.updateRunStatus as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const handle = await worker.claim('inbox');
    expect(handle).not.toBeNull();
    await worker.complete(VALID_PAYLOAD.runId, { output: { bad: true } });

    const failCalls = (db.updateRunStatus as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: unknown[]) => c[1] === 'failed',
    );
    expect(failCalls.length).toBe(1);
    const errorObj = failCalls[0]?.[2] as Record<string, unknown> | undefined;
    expect(errorObj?.error).toHaveProperty('code', 'AGENT_OUTPUT_REJECTED');
    expect(tc.recordViolation).toHaveBeenCalledWith('snap-001', 'hard');
  });

  it('Worker without trustClient → gates skipped, WARN logged once', async () => {
    const fakeBoss = createFakeBoss();
    const worker = new PgBossWorker(
      fakeBoss as unknown as import('pg-boss').PgBoss, () => undefined,
    );
    const db = await import('@flow/db');
    fakeBoss.fetch.mockResolvedValue([{ id: 'job-1', data: VALID_PAYLOAD }]);
    (db.claimRunWithGuard as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const handle = await worker.claim('inbox');
    expect(handle).not.toBeNull();
    const audit = await import('../shared/audit-writer');
    const warnCalls = (audit.writeAuditLog as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c: unknown[]) => (c[0] as Record<string, unknown>).action === 'gate.not_configured',
    );
    expect(warnCalls.length).toBe(1);
  });

  it('factory creates orchestrator with and without trust config', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    const { createOrchestrator } = await import('../orchestrator/factory');
    const without = createOrchestrator();
    expect(without).toHaveProperty('producer');
    expect(without).toHaveProperty('worker');
    delete process.env.DATABASE_URL;
  });

  it('validateActiveAgents called at factory creation with registry', () => {
    const registry = createOutputSchemaRegistry();
    registerMvpSchemas(registry);
    const spy = vi.spyOn(registry, 'validateActiveAgents');
    registry.validateActiveAgents(['inbox', 'calendar', 'ar-collection']);
    expect(spy).toHaveBeenCalledWith(['inbox', 'calendar', 'ar-collection']);
  });

  it('snapshotId read from DB on post-check (not in-process cache)', async () => {
    const tc = makeTrustClient(makeDecision({ allowed: true, level: 'auto', preconditionsPassed: true }));
    const registry = createOutputSchemaRegistry();
    registry.register('inbox', 'execute', z.object({ result: z.string() }));
    const fakeBoss = createFakeBoss();
    const worker = new PgBossWorker(
      fakeBoss as unknown as import('pg-boss').PgBoss, () => undefined, tc, registry,
    );
    const db = await import('@flow/db');
    fakeBoss.fetch.mockResolvedValue([{ id: 'job-1', data: VALID_PAYLOAD }]);
    (db.claimRunWithGuard as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (db.getRunById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: VALID_PAYLOAD.runId, agent_id: 'inbox', job_id: 'job-1',
      workspace_id: VALID_PAYLOAD.workspaceId, action_type: 'execute',
      trust_snapshot_id: 'snap-from-db-record',
    });
    (db.updateRunStatus as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await worker.claim('inbox');
    await worker.complete(VALID_PAYLOAD.runId, { output: { bad: true } });
    expect(tc.recordViolation).toHaveBeenCalledWith('snap-from-db-record', 'hard');
  });

  it('concurrent pre-check + post-check on different agents → independent', async () => {
    const tc = makeTrustClient(makeDecision({ allowed: true, level: 'auto', preconditionsPassed: true }));
    const fakeBoss = createFakeBoss();
    const worker = new PgBossWorker(
      fakeBoss as unknown as import('pg-boss').PgBoss, () => undefined, tc, undefined,
    );
    const db = await import('@flow/db');
    const payloadInbox = { ...VALID_PAYLOAD, agentId: 'inbox' as const };
    fakeBoss.fetch.mockResolvedValueOnce([{ id: 'job-1', data: payloadInbox }]);
    (db.claimRunWithGuard as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const handle = await worker.claim('inbox');
    expect(handle).not.toBeNull();
  });
});
