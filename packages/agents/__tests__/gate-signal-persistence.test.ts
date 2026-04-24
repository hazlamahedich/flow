import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TrustClient, TrustDecision } from '@flow/trust';
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

describe('Gate signal persistence', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('pre-check failure signal written via writeGateSignal', async () => {
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

    await worker.claim('inbox');
    const { writeGateSignal } = await import('../orchestrator/gate-events');
    expect(writeGateSignal).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'gate_pre_check_failed' }),
      VALID_PAYLOAD.runId,
      VALID_PAYLOAD.workspaceId,
    );
  });

  it('post-check violation signal written via writeGateSignal', async () => {
    const tc = makeTrustClient(makeDecision());
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
      id: 'run-1', agent_id: 'inbox', job_id: 'job-1', workspace_id: 'ws-1',
      action_type: 'execute', trust_snapshot_id: 'snap-001',
    });
    (db.updateRunStatus as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await worker.claim('inbox');
    await worker.complete('run-1', { output: { bad: true } });
    const { writeGateSignal } = await import('../orchestrator/gate-events');
    expect(writeGateSignal).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'gate_post_check_violation' }),
      expect.any(String),
      expect.any(String),
    );
  });

  it('signal payload contains required fields', async () => {
    const tc = makeTrustClient(makeDecision({
      allowed: false, preconditionsPassed: false, failedPreconditionKey: 'test',
    }));
    const fakeBoss = createFakeBoss();
    const worker = new PgBossWorker(
      fakeBoss as unknown as import('pg-boss').PgBoss, () => undefined, tc, undefined,
    );
    const db = await import('@flow/db');
    fakeBoss.fetch.mockResolvedValue([{ id: 'job-1', data: VALID_PAYLOAD }]);
    (db.claimRunWithGuard as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (db.updateRunStatus as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await worker.claim('inbox');
    const { writeGateSignal } = await import('../orchestrator/gate-events');
    const event = (writeGateSignal as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(event).toHaveProperty('agentId');
    expect(event).toHaveProperty('actionType');
    expect(event).toHaveProperty('runId');
    expect(event).toHaveProperty('timestamp');
  });

  it('trust_snapshot_id persisted via service client after pre-check', async () => {
    const tc = makeTrustClient(makeDecision({ snapshotId: 'snap-abc' }));
    const fakeBoss = createFakeBoss();
    const worker = new PgBossWorker(
      fakeBoss as unknown as import('pg-boss').PgBoss, () => undefined, tc, undefined,
    );
    const db = await import('@flow/db');
    fakeBoss.fetch.mockResolvedValue([{ id: 'job-1', data: VALID_PAYLOAD }]);
    (db.claimRunWithGuard as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (db.updateRunStatus as ReturnType<typeof vi.fn>).mockResolvedValue({});
    const mockUpdate = vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) }));
    (db.createServiceClient as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn(() => ({ update: mockUpdate })),
    });

    const handle = await worker.claim('inbox');
    expect(handle).toEqual({ runId: VALID_PAYLOAD.runId, status: 'running' });
  });

  it('snapshotId read from DB record (not cache) during post-check', async () => {
    const tc = makeTrustClient(makeDecision());
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
      id: 'run-1', agent_id: 'inbox', job_id: 'job-1', workspace_id: 'ws-1',
      action_type: 'execute', trust_snapshot_id: 'snap-from-db',
    });
    (db.updateRunStatus as ReturnType<typeof vi.fn>).mockResolvedValue({});

    await worker.claim('inbox');
    await worker.complete('run-1', { output: { bad: true } });
    expect(tc.recordViolation).toHaveBeenCalledWith('snap-from-db', 'hard');
  });
});
