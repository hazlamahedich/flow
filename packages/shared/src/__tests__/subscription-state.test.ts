/**
 * Story 9.5b — shouldDequeueForWorkspace + helpers (T1.2)
 *
 * Pure unit tests for the subscription-state guards consumed by the
 * orchestrator (PgBossWorker.claim). No mocks — pure functions.
 *
 * FR60
 */
import { describe, test, expect } from 'vitest';
import {
  shouldDequeueForWorkspace,
  isPausedStatus,
  PAUSED_STATUSES,
} from '../subscription-state';
import type { SubscriptionStatus } from '@flow/types';

describe('shouldDequeueForWorkspace', () => {
  test.each([
    ['active', true],
    ['free', true],
    ['past_due', false],
    ['suspended', false],
    ['cancelled', false],
    ['deleted', false],
  ] as const)('status=%s → dequeue allowed=%s', (status, expected) => {
    expect(shouldDequeueForWorkspace(status)).toBe(expected);
  });

  test('covers every SubscriptionStatus value (no missing branches)', () => {
    const allStatuses: SubscriptionStatus[] = [
      'free', 'active', 'past_due', 'cancelled', 'suspended', 'deleted',
    ];
    for (const status of allStatuses) {
      expect(() => shouldDequeueForWorkspace(status)).not.toThrow();
    }
  });

  test('active and free are the only dequeuing statuses', () => {
    const allStatuses: SubscriptionStatus[] = [
      'free', 'active', 'past_due', 'cancelled', 'suspended', 'deleted',
    ];
    const dequeuing = allStatuses.filter((s) => shouldDequeueForWorkspace(s));
    expect(dequeuing).toEqual(['free', 'active']);
  });

  test('EC8 — reactivation resumes dequeue (past_due → active)', () => {
    expect(shouldDequeueForWorkspace('past_due')).toBe(false);
    expect(shouldDequeueForWorkspace('active')).toBe(true);
  });

  test('EC13 — suspended → active reactivation resumes dequeue', () => {
    expect(shouldDequeueForWorkspace('suspended')).toBe(false);
    expect(shouldDequeueForWorkspace('active')).toBe(true);
  });

  test('EC1 — cancelled blocks dequeue', () => {
    expect(shouldDequeueForWorkspace('cancelled')).toBe(false);
  });
});

describe('PAUSED_STATUSES', () => {
  test('contains past_due, suspended, cancelled, deleted', () => {
    expect(PAUSED_STATUSES.has('past_due')).toBe(true);
    expect(PAUSED_STATUSES.has('suspended')).toBe(true);
    expect(PAUSED_STATUSES.has('cancelled')).toBe(true);
    expect(PAUSED_STATUSES.has('deleted')).toBe(true);
  });

  test('does NOT contain active or free', () => {
    expect(PAUSED_STATUSES.has('active')).toBe(false);
    expect(PAUSED_STATUSES.has('free')).toBe(false);
  });

  test('is frozen (immutable)', () => {
    expect(Object.isFrozen(PAUSED_STATUSES)).toBe(true);
  });
});

describe('isPausedStatus', () => {
  test.each([
    ['active', false],
    ['free', false],
    ['past_due', true],
    ['suspended', true],
    ['cancelled', true],
    ['deleted', true],
  ] as const)('status=%s → paused=%s', (status, expected) => {
    expect(isPausedStatus(status)).toBe(expected);
  });
});
