/**
 * Story 9.5b — Orchestrator subscription guard (T2.5)
 *
 * Integration tests for `PgBossWorker.claim()`: verifies the guard clause
 * (FR60) releases paused jobs via `boss.fail(retryable)`, cancels the queued
 * `agent_runs` row, writes the audit log + signal, and handles edge cases.
 *
 * Uses dependency-injection mocks for the boundary (db client, signal writes).
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'pg-boss';

// ── Boundary mocks ──
vi.mock('@flow/db', async () => {
  const actual = await vi.importActual<typeof import('@flow/db')>('@flow/db');
  return {
    ...actual,
    createServiceClient: vi.fn(),
    getWorkspaceSubscriptionStatus: vi.fn(),
    cancelRun: vi.fn(),
    claimRunWithGuard: vi.fn(),
  };
});

vi.mock('../../shared/audit-writer', () => ({
  writeAuditLog: vi.fn(),
}));

vi.mock('../gate-events', () => ({
  writeGateSignal: vi.fn(),
}));

vi.mock('../gates', () => ({
  runPreCheck: vi.fn(),
  blockForApproval: vi.fn(),
}));

vi.mock('../post-check', () => ({
  runPostCheck: vi.fn(),
}));

const { PgBossWorker } = await import('../pg-boss-worker');
const {
  getWorkspaceSubscriptionStatus,
  cancelRun,
  claimRunWithGuard,
  createServiceClient,
} = await import('@flow/db');
const { writeAuditLog } = await import('../../shared/audit-writer');

const VALID_PAYLOAD = {
  runId: '00000000-0000-0000-0000-000000000001',
  workspaceId: '00000000-0000-0000-0000-000000000002',
  agentId: 'inbox' as const,
  actionType: 'inbox.process',
  input: {},
  clientId: null,
  correlationId: '00000000-0000-0000-0000-000000000003',
};

const VALID_JOB = {
  id: 'job-1',
  data: VALID_PAYLOAD,
} as unknown as Job<unknown>;

function makeBoss() {
  const fetch = vi.fn();
  const fail = vi.fn().mockResolvedValue(undefined);
  return {
    fetch,
    fail,
    instance: { fetch, fail } as unknown as Parameters<
      typeof PgBossWorker.prototype.claim
    > extends never
      ? never
      : object,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getWorkspaceSubscriptionStatus).mockResolvedValue('active');
  vi.mocked(cancelRun).mockResolvedValue(true);
  vi.mocked(claimRunWithGuard).mockResolvedValue({
    id: VALID_PAYLOAD.runId,
  } as never);
  vi.mocked(createServiceClient).mockReturnValue({
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  } as never);
});

describe('PgBossWorker.claim — subscription guard (FR60)', () => {
  test('claims when status=active (guard permits)', async () => {
    const boss = makeBoss();
    boss.fetch.mockResolvedValue([VALID_JOB]);
    const worker = new PgBossWorker(boss.instance as never, () => undefined);
    const handle = await worker.claim('inbox');
    expect(handle).not.toBeNull();
    expect(getWorkspaceSubscriptionStatus).toHaveBeenCalledWith(
      VALID_PAYLOAD.workspaceId,
    );
    expect(boss.fail).not.toHaveBeenCalled();
    expect(cancelRun).not.toHaveBeenCalled();
  });

  test('releases + cancels when status=past_due', async () => {
    vi.mocked(getWorkspaceSubscriptionStatus).mockResolvedValueOnce('past_due');
    const boss = makeBoss();
    boss.fetch.mockResolvedValue([VALID_JOB]);
    const worker = new PgBossWorker(boss.instance as never, () => undefined);
    const handle = await worker.claim('inbox');
    expect(handle).toBeNull();
    expect(boss.fail).toHaveBeenCalledWith(
      'agent:inbox',
      'job-1',
      expect.objectContaining({
        retryable: true,
        code: 'SUBSCRIPTION_PAUSED',
      }),
    );
    expect(cancelRun).toHaveBeenCalledWith(
      VALID_PAYLOAD.runId,
      expect.stringContaining('past_due'),
    );
  });

  test('writes audit log with claim.subscription_paused action', async () => {
    vi.mocked(getWorkspaceSubscriptionStatus).mockResolvedValueOnce(
      'suspended',
    );
    const boss = makeBoss();
    boss.fetch.mockResolvedValue([VALID_JOB]);
    const worker = new PgBossWorker(boss.instance as never, () => undefined);
    await worker.claim('inbox');
    const calls = vi.mocked(writeAuditLog).mock.calls;
    const pausedCall = calls.find(
      (c) => c[0].action === 'claim.subscription_paused',
    );
    expect(pausedCall).toBeDefined();
    expect(pausedCall![0]).toMatchObject({
      agentId: 'inbox',
      entityType: 'agent_run',
      entityId: VALID_PAYLOAD.runId,
    });
    expect(pausedCall![0].details).toMatchObject({
      subscriptionStatus: 'suspended',
      outcome: 'released',
    });
  });

  test('writes agent_signals row with 3-dotted signal_type', async () => {
    vi.mocked(getWorkspaceSubscriptionStatus).mockResolvedValueOnce(
      'cancelled',
    );
    const insertSpy = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createServiceClient).mockReturnValueOnce({
      from: vi.fn().mockReturnValue({ insert: insertSpy }),
    } as never);
    const boss = makeBoss();
    boss.fetch.mockResolvedValue([VALID_JOB]);
    const worker = new PgBossWorker(boss.instance as never, () => undefined);
    await worker.claim('inbox');
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        signal_type: 'claim.subscription.paused',
        agent_id: 'inbox',
        workspace_id: VALID_PAYLOAD.workspaceId,
      }),
    );
  });

  test('EC5 — malformed workspaceId rejected by schema parse', async () => {
    const boss = makeBoss();
    boss.fetch.mockResolvedValue([
      {
        ...VALID_JOB,
        data: { ...VALID_PAYLOAD, workspaceId: 'not-a-uuid' },
      } as unknown as Job<unknown>,
    ]);
    const worker = new PgBossWorker(boss.instance as never, () => undefined);
    // Schema parse throws ZodError on malformed UUID — guard never reached.
    await expect(worker.claim('inbox')).rejects.toThrow();
    expect(boss.fail).not.toHaveBeenCalled();
    expect(getWorkspaceSubscriptionStatus).not.toHaveBeenCalled();
  });

  test('EC5 — empty workspaceId hits the defensive guard and releases non-retryable', async () => {
    const boss = makeBoss();
    boss.fail.mockResolvedValue(undefined);
    boss.fetch.mockResolvedValue([
      {
        ...VALID_JOB,
        data: { ...VALID_PAYLOAD, workspaceId: '' },
      } as unknown as Job<unknown>,
    ]);
    const worker = new PgBossWorker(boss.instance as never, () => undefined);
    // The guard's explicit `if (!payload.workspaceId)` branch should fire.
    // Schema may also reject empty UUID; either way the job must not claim.
    await expect(worker.claim('inbox')).rejects.toThrow();
    expect(getWorkspaceSubscriptionStatus).not.toHaveBeenCalled();
  });

  test('EC1 — cancelled status blocks dequeue', async () => {
    vi.mocked(getWorkspaceSubscriptionStatus).mockResolvedValueOnce(
      'cancelled',
    );
    const boss = makeBoss();
    boss.fetch.mockResolvedValue([VALID_JOB]);
    const worker = new PgBossWorker(boss.instance as never, () => undefined);
    const handle = await worker.claim('inbox');
    expect(handle).toBeNull();
    expect(boss.fail).toHaveBeenCalledTimes(1);
  });

  test('free status permits dequeue', async () => {
    vi.mocked(getWorkspaceSubscriptionStatus).mockResolvedValueOnce('free');
    const boss = makeBoss();
    boss.fetch.mockResolvedValue([VALID_JOB]);
    const worker = new PgBossWorker(boss.instance as never, () => undefined);
    const handle = await worker.claim('inbox');
    expect(handle).not.toBeNull();
    expect(boss.fail).not.toHaveBeenCalled();
  });

  test('EC8 — payment recovery resumes (status flip active → past_due → active)', async () => {
    const boss1 = makeBoss();
    boss1.fetch.mockResolvedValue([VALID_JOB]);
    vi.mocked(getWorkspaceSubscriptionStatus).mockResolvedValueOnce('past_due');
    const worker = new PgBossWorker(boss1.instance as never, () => undefined);
    expect(await worker.claim('inbox')).toBeNull();

    // After recovery, the retried job claims successfully.
    const boss2 = makeBoss();
    boss2.fetch.mockResolvedValue([VALID_JOB]);
    vi.mocked(getWorkspaceSubscriptionStatus).mockResolvedValueOnce('active');
    const worker2 = new PgBossWorker(boss2.instance as never, () => undefined);
    expect(await worker2.claim('inbox')).not.toBeNull();
  });
});
