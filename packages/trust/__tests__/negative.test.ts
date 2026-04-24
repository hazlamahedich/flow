import { describe, it, expect, vi } from 'vitest';
import { createTrustClient } from '../src/client/trust-client';
import type { TrustLevel } from '../src/types';
import { applyScoreChange, getRiskWeight } from '../src/scoring';

function makeEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'entry-1',
    workspace_id: 'ws-1',
    agent_id: 'inbox',
    action_type: 'categorize_email',
    current_level: 'supervised' as TrustLevel,
    score: 50,
    total_executions: 10,
    successful_executions: 8,
    consecutive_successes: 5,
    violation_count: 2,
    last_transition_at: new Date().toISOString(),
    last_violation_at: null,
    cooldown_until: null,
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeDeps(overrides: Record<string, unknown> = {}) {
  return {
    getTrustMatrixEntry: vi.fn(),
    upsertTrustMatrixEntry: vi.fn().mockResolvedValue(makeEntry()),
    insertSnapshot: vi.fn().mockResolvedValue({ id: 'snap-1', created_at: new Date().toISOString() }),
    getPreconditions: vi.fn().mockResolvedValue([]),
    recordSuccess: vi.fn().mockResolvedValue(makeEntry({ score: 51, version: 2 })),
    recordViolation: vi.fn().mockResolvedValue(makeEntry({ score: 40, version: 2 })),
    recordPrecheckFailure: vi.fn().mockResolvedValue(makeEntry({ score: 45, version: 2 })),
    updateTrustMatrixEntry: vi.fn().mockResolvedValue(makeEntry({ version: 2 })),
    insertTransition: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
}

describe('negative and edge cases', () => {
  it('invalid action type uses default risk weight 1.0', () => {
    expect(getRiskWeight('inbox', 'totally_invalid_action')).toBe(1.0);
  });

  it('null/undefined context — preconditions pass vacuously', async () => {
    const deps = makeDeps({
      upsertTrustMatrixEntry: vi.fn().mockResolvedValue(makeEntry({ current_level: 'auto', score: 180 })),
    });
    const client = createTrustClient(deps);
    const result = await client.canAct('inbox', 'categorize_email', 'ws-1', 'exec-1', {});
    expect(result.level).toBe('auto');
    expect(result.preconditionsPassed).toBe(true);
  });

  it('score overflow (199 + success) caps at 200', () => {
    expect(applyScoreChange(199, 5)).toBe(200);
  });

  it('score underflow (1 + violation × 2.0 weight) floors at 0', () => {
    expect(applyScoreChange(1, -10)).toBe(0);
  });

  it('malformed violation metadata still records', async () => {
    const deps = makeDeps({
      upsertTrustMatrixEntry: vi.fn().mockResolvedValue(makeEntry({ current_level: 'confirm', score: 100 })),
      recordViolation: vi.fn().mockResolvedValue(makeEntry({ current_level: 'supervised', score: 95, version: 2 })),
    });
    const client = createTrustClient(deps);
    const decision = await client.canAct('inbox', 'categorize_email', 'ws-1', 'exec-1', {});
    await expect(client.recordViolation(decision.snapshotId!, 'soft')).resolves.toBeUndefined();
    expect(deps.recordViolation).toHaveBeenCalled();
  });

  it('expired auth / query failure defaults to supervised', async () => {
    const deps = makeDeps({
      upsertTrustMatrixEntry: vi.fn().mockRejectedValue(new Error('JWT expired')),
    });
    const client = createTrustClient(deps);
    const result = await client.canAct('inbox', 'categorize_email', 'ws-1', 'exec-1', {});
    expect(result.level).toBe('supervised');
    expect(result.allowed).toBe(false);
  });

  it('empty workspace trust matrix — upsert creates new entry', async () => {
    const deps = makeDeps({
      upsertTrustMatrixEntry: vi.fn().mockResolvedValue(
        makeEntry({
          id: 'new',
          current_level: 'supervised',
          score: 0,
          version: 1,
          workspace_id: 'ws-new',
          total_executions: 0,
          successful_executions: 0,
          consecutive_successes: 0,
          violation_count: 0,
        }),
      ),
    });
    const client = createTrustClient(deps);
    const result = await client.canAct('inbox', 'categorize_email', 'ws-new', 'exec-1', {});
    expect(result.level).toBe('supervised');
    expect(deps.upsertTrustMatrixEntry).toHaveBeenCalledWith('ws-new', 'inbox', 'categorize_email');
  });
});
