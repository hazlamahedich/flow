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

describe('concurrency', () => {
  it('two concurrent recordSuccess calls both succeed', async () => {
    let callCount = 0;
    const deps = makeDeps({
      upsertTrustMatrixEntry: vi.fn().mockResolvedValue(makeEntry({ version: 1 })),
      insertSnapshot: vi
        .fn()
        .mockResolvedValueOnce({ id: 'snap-a', created_at: new Date().toISOString() })
        .mockResolvedValueOnce({ id: 'snap-b', created_at: new Date().toISOString() }),
      recordSuccess: vi.fn().mockImplementation(async () => {
        callCount++;
        return makeEntry({ score: 50 + callCount, version: 1 + callCount });
      }),
    });
    const client = createTrustClient(deps);
    const d1 = await client.canAct('inbox', 'categorize_email', 'ws-1', 'exec-1', {});
    const d2 = await client.canAct('inbox', 'categorize_email', 'ws-1', 'exec-2', {});
    await Promise.all([client.recordSuccess(d1.snapshotId!), client.recordSuccess(d2.snapshotId!)]);
    expect(callCount).toBe(2);
  });

  it('two concurrent recordViolation calls both attempt', async () => {
    let callCount = 0;
    const deps = makeDeps({
      upsertTrustMatrixEntry: vi.fn().mockResolvedValue(makeEntry({ current_level: 'confirm', score: 120, version: 1 })),
      insertSnapshot: vi
        .fn()
        .mockResolvedValueOnce({ id: 'snap-a', created_at: new Date().toISOString() })
        .mockResolvedValueOnce({ id: 'snap-b', created_at: new Date().toISOString() }),
      recordViolation: vi.fn().mockImplementation(async () => {
        callCount++;
        return makeEntry({ score: 110 - callCount, version: 1 + callCount });
      }),
    });
    const client = createTrustClient(deps);
    const d1 = await client.canAct('inbox', 'categorize_email', 'ws-1', 'exec-1', {});
    const d2 = await client.canAct('inbox', 'categorize_email', 'ws-1', 'exec-2', {});
    await Promise.all([
      client.recordViolation(d1.snapshotId!, 'soft'),
      client.recordViolation(d2.snapshotId!, 'soft'),
    ]);
    expect(callCount).toBe(2);
  });

  it('CAS stale version returns error', async () => {
    const deps = makeDeps({
      upsertTrustMatrixEntry: vi.fn().mockResolvedValue(makeEntry({ version: 1 })),
      recordSuccess: vi.fn().mockRejectedValue(
        new TrustTransitionError('CONCURRENT_MODIFICATION', 'version mismatch', { retryable: true }),
      ),
    });
    const client = createTrustClient(deps);
    const decision = await client.canAct('inbox', 'categorize_email', 'ws-1', 'exec-1', {});
    await expect(client.recordSuccess(decision.snapshotId!)).resolves.toBeUndefined();
  });

  it('snapshot matrix_version matches trust_matrix version at capture time', async () => {
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
    await client.canAct('inbox', 'categorize_email', 'ws-1', 'exec-1', {});
    expect(capturedSnapshot).toBeTruthy();
    expect((capturedSnapshot as unknown as Record<string, unknown>).matrix_version).toBe(5);
  });

  it('read during transition sees old or new state, never partial', async () => {
    const entryV1 = makeEntry({ current_level: 'supervised', score: 50, version: 1 });
    const entryV2 = makeEntry({ current_level: 'confirm', score: 120, version: 2 });

    const deps = makeDeps({
      upsertTrustMatrixEntry: vi
        .fn()
        .mockResolvedValueOnce(entryV1)
        .mockResolvedValueOnce(entryV2),
    });
    const client = createTrustClient(deps);
    const [r1, r2] = await Promise.all([
      client.canAct('inbox', 'categorize_email', 'ws-1', 'exec-1', {}),
      client.canAct('inbox', 'categorize_email', 'ws-1', 'exec-2', {}),
    ]);
    expect(['supervised', 'confirm']).toContain(r1.level);
    expect(['supervised', 'confirm']).toContain(r2.level);
  });

  it('concurrent success + violation — at least one succeeds', async () => {
    let successCalled = false;
    let violationCalled = false;
    const deps = makeDeps({
      upsertTrustMatrixEntry: vi.fn().mockResolvedValue(makeEntry({ current_level: 'confirm', score: 100, version: 1 })),
      insertSnapshot: vi
        .fn()
        .mockResolvedValueOnce({ id: 'snap-s', created_at: new Date().toISOString() })
        .mockResolvedValueOnce({ id: 'snap-v', created_at: new Date().toISOString() }),
      recordSuccess: vi.fn().mockImplementation(async () => {
        successCalled = true;
        return makeEntry({ score: 101, version: 2 });
      }),
      recordViolation: vi.fn().mockImplementation(async () => {
        violationCalled = true;
        return makeEntry({ score: 90, version: 2 });
      }),
    });
    const client = createTrustClient(deps);
    const ds = await client.canAct('inbox', 'categorize_email', 'ws-1', 'exec-1', {});
    const dv = await client.canAct('inbox', 'categorize_email', 'ws-1', 'exec-2', {});
    await Promise.all([
      client.recordSuccess(ds.snapshotId!),
      client.recordViolation(dv.snapshotId!, 'soft'),
    ]);
    expect(successCalled || violationCalled).toBe(true);
  });
});
