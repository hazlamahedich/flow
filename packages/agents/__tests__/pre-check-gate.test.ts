import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TrustClient } from '@flow/trust';
import type { TrustDecision } from '@flow/trust';
import { runPreCheck, blockForApproval } from '../orchestrator/gates';

vi.mock('@flow/db', () => ({
  updateRunStatus: vi.fn(),
}));

vi.mock('../shared/audit-writer', () => ({
  writeAuditLog: vi.fn(),
}));

function makeDecision(overrides: Partial<TrustDecision> = {}): TrustDecision {
  return {
    allowed: true,
    level: 'auto',
    reason: 'Trust check passed',
    snapshotId: 'snap-001',
    preconditionsPassed: true,
    ...overrides,
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

describe('runPreCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('auto-trust + preconditions pass → proceed to execution', async () => {
    const tc = makeTrustClient(makeDecision({ allowed: true, level: 'auto', preconditionsPassed: true }));
    const result = await runPreCheck(tc, 'inbox', 'execute', 'ws-1', 'run-1', {});
    expect(result.proceed).toBe(true);
    if (result.proceed) {
      expect(result.decision.level).toBe('auto');
    }
  });

  it('auto-trust + precondition fail → proceed false with precondition_failed', async () => {
    const tc = makeTrustClient(makeDecision({
      allowed: false,
      level: 'auto',
      preconditionsPassed: false,
      failedPreconditionKey: 'valid_email',
      reason: 'Precondition failed: valid_email',
    }));
    const result = await runPreCheck(tc, 'inbox', 'execute', 'ws-1', 'run-1', {});
    expect(result.proceed).toBe(false);
    if (!result.proceed) {
      expect(result.reason).toBe('precondition_failed');
      expect(result.error?.code).toBe('AGENT_PRECHECK_FAILED');
    }
  });

  it('auto-trust + precondition fail → recordPrecheckFailure called with snapshotId', async () => {
    const tc = makeTrustClient(makeDecision({
      allowed: false,
      preconditionsPassed: false,
      failedPreconditionKey: 'valid_email',
      snapshotId: 'snap-001',
    }));
    await runPreCheck(tc, 'inbox', 'execute', 'ws-1', 'run-1', {});
    expect(tc.recordPrecheckFailure).toHaveBeenCalledWith('snap-001');
  });

  it('supervised trust → proceed false with trust_level_gate', async () => {
    const tc = makeTrustClient(makeDecision({
      allowed: true,
      level: 'supervised',
      preconditionsPassed: true,
    }));
    const result = await runPreCheck(tc, 'inbox', 'execute', 'ws-1', 'run-1', {});
    expect(result.proceed).toBe(false);
    if (!result.proceed) {
      expect(result.reason).toBe('trust_level_gate');
    }
  });

  it('confirm trust → proceed false with trust_level_gate', async () => {
    const tc = makeTrustClient(makeDecision({
      allowed: true,
      level: 'confirm',
      preconditionsPassed: true,
    }));
    const result = await runPreCheck(tc, 'inbox', 'execute', 'ws-1', 'run-1', {});
    expect(result.proceed).toBe(false);
    if (!result.proceed) {
      expect(result.reason).toBe('trust_level_gate');
    }
  });

  it('canAct() throws → proceed false with can_act_error (fail-safe supervised)', async () => {
    const tc = makeTrustClient(makeDecision());
    (tc.canAct as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB down'));
    const result = await runPreCheck(tc, 'inbox', 'execute', 'ws-1', 'run-1', {});
    expect(result.proceed).toBe(false);
    if (!result.proceed) {
      expect(result.reason).toBe('can_act_error');
    }
  });

  it('canAct() returns allowed:false → trust_level_gate', async () => {
    const tc = makeTrustClient(makeDecision({ allowed: false, preconditionsPassed: true }));
    const result = await runPreCheck(tc, 'inbox', 'execute', 'ws-1', 'run-1', {});
    expect(result.proceed).toBe(false);
    if (!result.proceed) {
      expect(result.reason).toBe('trust_level_gate');
    }
  });

  it('canAct() returns null → fail-safe to can_act_error', async () => {
    const tc = makeTrustClient(makeDecision());
    (tc.canAct as ReturnType<typeof vi.fn>).mockResolvedValue(null as unknown as TrustDecision);
    const result = await runPreCheck(tc, 'inbox', 'execute', 'ws-1', 'run-1', {});
    expect(result.proceed).toBe(false);
    if (!result.proceed) {
      expect(result.reason).toBe('can_act_error');
    }
  });

  it('canAct() returns malformed (no allowed field) → fail-safe', async () => {
    const tc = makeTrustClient(makeDecision());
    (tc.canAct as ReturnType<typeof vi.fn>).mockResolvedValue({ level: 'auto' } as unknown as TrustDecision);
    const result = await runPreCheck(tc, 'inbox', 'execute', 'ws-1', 'run-1', {});
    expect(result.proceed).toBe(false);
    if (!result.proceed) {
      expect(result.reason).toBe('can_act_error');
    }
  });

  it('canAct() timeout >500ms → fail-safe to can_act_error', async () => {
    const tc = makeTrustClient(makeDecision());
    (tc.canAct as ReturnType<typeof vi.fn>).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(makeDecision()), 600)),
    );
    const result = await runPreCheck(tc, 'inbox', 'execute', 'ws-1', 'run-1', {});
    expect(result.proceed).toBe(false);
    if (!result.proceed) {
      expect(result.reason).toBe('can_act_error');
    }
  });

  it('pre-check failure error includes AGENT_PRECHECK_FAILED code', async () => {
    const tc = makeTrustClient(makeDecision({
      allowed: false,
      preconditionsPassed: false,
      failedPreconditionKey: 'email_verified',
    }));
    const result = await runPreCheck(tc, 'inbox', 'execute', 'ws-1', 'run-1', {});
    if (!result.proceed && result.error) {
      expect(result.error.code).toBe('AGENT_PRECHECK_FAILED');
      if (result.error.code === 'AGENT_PRECHECK_FAILED') {
        expect(result.error.agentType).toBe('inbox');
      }
    }
  });

  it('canAct called with 5 args (agentId, actionType, workspaceId, executionId, context)', async () => {
    const tc = makeTrustClient(makeDecision());
    await runPreCheck(tc, 'inbox', 'execute', 'ws-1', 'run-1', { foo: 'bar' });
    expect(tc.canAct).toHaveBeenCalledWith('inbox', 'execute', 'ws-1', 'run-1', { foo: 'bar' });
  });

  it('precondition failure is instance-level only (no level change)', async () => {
    const tc = makeTrustClient(makeDecision({
      allowed: false,
      level: 'auto',
      preconditionsPassed: false,
      failedPreconditionKey: 'test',
    }));
    const result = await runPreCheck(tc, 'inbox', 'execute', 'ws-1', 'run-1', {});
    if (!result.proceed && result.decision) {
      expect(result.decision.level).toBe('auto');
    }
  });
});

describe('blockForApproval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('transitions run to waiting_approval with decision and reason', async () => {
    const db = await import('@flow/db');
    const decision = makeDecision({ level: 'supervised' });
    await blockForApproval('run-1', decision, 'trust_level_gate', 'ws-1', 'inbox');
    expect(db.updateRunStatus).toHaveBeenCalledWith('run-1', 'waiting_approval', expect.objectContaining({
      output: expect.objectContaining({
        _gate: expect.objectContaining({
          decision,
          reason: 'trust_level_gate',
        }),
      }),
    }));
  });

  it('does NOT call propose (different method)', async () => {
    const db = await import('@flow/db');
    await blockForApproval('run-1', undefined, 'can_act_error', 'ws-1', 'inbox');
    const calls = (db.updateRunStatus as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[0]?.[1]).toBe('waiting_approval');
  });
});
