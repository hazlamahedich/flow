import { describe, it, expect, vi } from 'vitest';
import { createTrustClient } from '../src/client/trust-client';
import { TrustTransitionError } from '../src/errors';
import type { TrustLevel } from '../src/types';

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
describe('trust client integration', () => {
  it('canAct lazy-creates entry on first interaction', async () => {
    const deps = makeDeps({
      upsertTrustMatrixEntry: vi.fn().mockResolvedValue(makeEntry({ current_level: 'supervised', score: 0 })),
    });
    const client = createTrustClient(deps);
    const result = await client.canAct('inbox', 'categorize_email', 'ws-1', 'exec-1', {});
    expect(result.allowed).toBe(true);
    expect(result.level).toBe('supervised');
    expect(deps.upsertTrustMatrixEntry).toHaveBeenCalledWith('ws-1', 'inbox', 'categorize_email');
  });

  it('canAct returns supervised when DB fails', async () => {
    const deps = makeDeps({
      upsertTrustMatrixEntry: vi.fn().mockRejectedValue(new Error('DB down')),
    });
    const client = createTrustClient(deps);
    const result = await client.canAct('inbox', 'categorize_email', 'ws-1', 'exec-1', {});
    expect(result.level).toBe('supervised');
    expect(result.allowed).toBe(false);
  });

  it('canAct captures snapshot with matrix version', async () => {
    const entry = makeEntry({ current_level: 'confirm', score: 120, version: 5 });
    let capturedSnapshot: Record<string, unknown> | null = null;
    const deps = makeDeps({
      upsertTrustMatrixEntry: vi.fn().mockResolvedValue(entry),
      insertSnapshot: vi.fn().mockImplementation(async (snap: Record<string, unknown>) => {
        capturedSnapshot = snap;
        return { id: 'snap-v5', created_at: new Date().toISOString() };
      }),
    });
    const client = createTrustClient(deps);
    const result = await client.canAct('inbox', 'categorize_email', 'ws-1', 'exec-1', {});
    expect(deps.insertSnapshot).toHaveBeenCalled();
    expect(capturedSnapshot).toBeTruthy();
    expect((capturedSnapshot as unknown as Record<string, unknown>).matrix_version).toBe(5);
    expect(result.snapshotId).toBe('snap-v5');
  });

  it('canAct evaluates preconditions', async () => {
    const entry = makeEntry({ current_level: 'auto', score: 180 });
    const deps = makeDeps({
      upsertTrustMatrixEntry: vi.fn().mockResolvedValue(entry),
    });
    const client = createTrustClient(deps);
    const result = await client.canAct('inbox', 'categorize_email', 'ws-1', 'exec-1', {});
    expect(result.level).toBe('auto');
    expect(result.allowed).toBe(true);
  });

  it('recordSuccess increments score', async () => {
    const entry = makeEntry({ current_level: 'supervised', score: 50, version: 1 });
    const deps = makeDeps({
      upsertTrustMatrixEntry: vi.fn().mockResolvedValue(entry),
      recordSuccess: vi.fn().mockResolvedValue(makeEntry({ score: 51, version: 2 })),
    });
    const client = createTrustClient(deps);
    const decision = await client.canAct('inbox', 'categorize_email', 'ws-1', 'exec-1', {});
    await client.recordSuccess(decision.snapshotId!);
    expect(deps.recordSuccess).toHaveBeenCalledWith('ws-1', 'inbox', 'categorize_email', 1);
  });

  it('recordViolation applies risk weight and resets consecutive_successes', async () => {
    const entry = makeEntry({ current_level: 'confirm', score: 120, consecutive_successes: 10, version: 1 });
    const deps = makeDeps({
      upsertTrustMatrixEntry: vi.fn().mockResolvedValue(entry),
      recordViolation: vi.fn().mockResolvedValue(
        makeEntry({ current_level: 'supervised', score: 119, consecutive_successes: 0, version: 2 }),
      ),
    });
    const client = createTrustClient(deps);
    const decision = await client.canAct('inbox', 'categorize_email', 'ws-1', 'exec-1', {});
    await client.recordViolation(decision.snapshotId!, 'soft');
    expect(deps.recordViolation).toHaveBeenCalledWith(
      'ws-1', 'inbox', 'categorize_email', 'soft', expect.any(Number), 1, 'supervised',
    );
  });

  it('CAS version mismatch returns error', async () => {
    const entry = makeEntry({ version: 1 });
    const deps = makeDeps({
      upsertTrustMatrixEntry: vi.fn().mockResolvedValue(entry),
      recordSuccess: vi.fn().mockRejectedValue(
        new TrustTransitionError('CONCURRENT_MODIFICATION', 'version mismatch', { retryable: true }),
      ),
    });
    const client = createTrustClient(deps);
    const decision = await client.canAct('inbox', 'categorize_email', 'ws-1', 'exec-1', {});
    await expect(client.recordSuccess(decision.snapshotId!)).resolves.toBeUndefined();
  });

  it('full cycle: canAct → recordSuccess × 3', async () => {
    let version = 1;
    const deps = makeDeps({
      upsertTrustMatrixEntry: vi.fn().mockResolvedValue(makeEntry({ version: 1 })),
      insertSnapshot: vi.fn()
        .mockResolvedValueOnce({ id: 'snap-1', created_at: new Date().toISOString() })
        .mockResolvedValueOnce({ id: 'snap-2', created_at: new Date().toISOString() })
        .mockResolvedValueOnce({ id: 'snap-3', created_at: new Date().toISOString() })
        .mockResolvedValueOnce({ id: 'snap-4', created_at: new Date().toISOString() }),
      recordSuccess: vi.fn().mockImplementation(async () => {
        version++;
        return makeEntry({ version });
      }),
    });
    const client = createTrustClient(deps);
    const d1 = await client.canAct('inbox', 'categorize_email', 'ws-1', 'exec-1', {});
    await client.recordSuccess(d1.snapshotId!);
    const d2 = await client.canAct('inbox', 'categorize_email', 'ws-1', 'exec-2', {});
    await client.recordSuccess(d2.snapshotId!);
    const d3 = await client.canAct('inbox', 'categorize_email', 'ws-1', 'exec-3', {});
    await client.recordSuccess(d3.snapshotId!);
    expect(deps.recordSuccess).toHaveBeenCalledTimes(3);
  });

  it('full cycle: recordViolation → trust reflects new level', async () => {
    const entryConfirm = makeEntry({ current_level: 'confirm', score: 120, version: 1 });
    const entryDemoted = makeEntry({ current_level: 'supervised', score: 100, version: 2 });
    const deps = makeDeps({
      upsertTrustMatrixEntry: vi
        .fn()
        .mockResolvedValueOnce(entryConfirm)
        .mockResolvedValueOnce(entryDemoted),
      recordViolation: vi.fn().mockResolvedValue(entryDemoted),
    });
    const client = createTrustClient(deps);
    const decision = await client.canAct('inbox', 'categorize_email', 'ws-1', 'exec-1', {});
    await client.recordViolation(decision.snapshotId!, 'soft');
    const nextDecision = await client.canAct('inbox', 'categorize_email', 'ws-1', 'exec-2', {});
    expect(nextDecision.level).toBe('supervised');
  });

  it('recordSuccess with auto level still succeeds', async () => {
    const entry = makeEntry({ current_level: 'auto', score: 180, version: 1 });
    const deps = makeDeps({
      upsertTrustMatrixEntry: vi.fn().mockResolvedValue(entry),
      recordSuccess: vi.fn().mockResolvedValue(makeEntry({ version: 2 })),
    });
    const client = createTrustClient(deps);
    const decision = await client.canAct('inbox', 'categorize_email', 'ws-1', 'exec-1', {});
    await client.recordSuccess(decision.snapshotId!);
    expect(deps.recordSuccess).toHaveBeenCalled();
  });

  it('recordViolation sets cooldown', async () => {
    const entry = makeEntry({ current_level: 'confirm', violation_count: 2, score: 120, version: 1 });
    const deps = makeDeps({
      upsertTrustMatrixEntry: vi.fn().mockResolvedValue(entry),
      recordViolation: vi.fn().mockResolvedValue(
        makeEntry({
          score: 100,
          current_level: 'supervised',
          cooldown_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          version: 2,
        }),
      ),
    });
    const client = createTrustClient(deps);
    const decision = await client.canAct('inbox', 'categorize_email', 'ws-1', 'exec-1', {});
    await client.recordViolation(decision.snapshotId!, 'soft');
    expect(deps.recordViolation).toHaveBeenCalledWith(
      'ws-1', 'inbox', 'categorize_email', 'soft', expect.any(Number), 1, 'supervised',
    );
  });

  it('recordViolation applies T3/T4/T5 transitions', async () => {
    const entry = makeEntry({ current_level: 'auto', violation_count: 2, score: 180, version: 1 });
    const deps = makeDeps({
      upsertTrustMatrixEntry: vi.fn().mockResolvedValue(entry),
      recordViolation: vi.fn().mockResolvedValue(
        makeEntry({ current_level: 'supervised', score: 160, version: 2 }),
      ),
    });
    const client = createTrustClient(deps);
    const decision = await client.canAct('inbox', 'categorize_email', 'ws-1', 'exec-1', {});
    await client.recordViolation(decision.snapshotId!, 'soft');
    expect(deps.recordViolation).toHaveBeenCalledWith(
      'ws-1', 'inbox', 'categorize_email', 'soft', expect.any(Number), 1, 'supervised',
    );
    expect(deps.insertTransition).toHaveBeenCalled();
  });

  it('recordSuccess respects cooldown', async () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const entry = makeEntry({ current_level: 'supervised', score: 65, cooldown_until: futureDate, version: 1 });
    const deps = makeDeps({
      upsertTrustMatrixEntry: vi.fn().mockResolvedValue(entry),
      recordSuccess: vi.fn().mockResolvedValue(makeEntry({ score: 66, version: 2 })),
    });
    const client = createTrustClient(deps);
    const decision = await client.canAct('inbox', 'categorize_email', 'ws-1', 'exec-1', {});
    await client.recordSuccess(decision.snapshotId!);
    expect(deps.recordSuccess).toHaveBeenCalled();
  });

  it('recordViolation applies risk weight correctly', async () => {
    const entry = makeEntry({ current_level: 'confirm', score: 100, version: 1 });
    const deps = makeDeps({
      upsertTrustMatrixEntry: vi.fn().mockResolvedValue(entry),
      recordViolation: vi.fn().mockResolvedValue(makeEntry({ score: 95, version: 2 })),
    });
    const client = createTrustClient(deps);
    const decision = await client.canAct('inbox', 'categorize_email', 'ws-1', 'exec-1', {});
    await client.recordViolation(decision.snapshotId!, 'soft');
    const call = deps.recordViolation.mock.calls[0] as [string, string, string, string, number, number];
    expect(call[4]).toBeGreaterThan(0);
  });
});
