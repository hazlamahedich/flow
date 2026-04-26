import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  shouldTriggerCheckIn,
  scheduleNextCheckIn,
  isMaxDeferralsReached,
  REVIEW_ITEMS_MIN,
  REVIEW_ITEMS_MAX,
  REVIEW_ITEMS_DEFAULT,
  SNOOZE_DAYS,
  MAX_DEFERRALS,
  AUTO_REVIEW_INTERVAL_DAYS,
  AUTO_ACTION_LOOKBACK_DAYS,
  AUTO_DISMISS_MS,
} from './check-in';
import type { TrustAuditRecord } from './check-in';

function makeAudit(overrides: Partial<TrustAuditRecord> = {}): TrustAuditRecord {
  return {
    lastReviewedAt: null,
    createdAt: '2025-01-01T00:00:00Z',
    deferredCount: 0,
    lastDeferredAt: null,
    ...overrides,
  };
}

describe('shouldTriggerCheckIn', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true for auto agent 30+ days since last review', () => {
    const audit = makeAudit({ lastReviewedAt: '2025-01-15T00:00:00Z' });
    expect(shouldTriggerCheckIn('auto', audit, true)).toBe(true);
  });

  it('returns true when opt-in enabled and no audit record', () => {
    expect(shouldTriggerCheckIn('auto', null, true)).toBe(true);
  });

  it('returns true when exactly 30 days since last review', () => {
    const audit = makeAudit({ lastReviewedAt: '2025-01-30T00:00:00Z' });
    expect(shouldTriggerCheckIn('auto', audit, true)).toBe(true);
  });

  it('returns false for non-auto agent', () => {
    expect(shouldTriggerCheckIn('confirm', makeAudit(), true)).toBe(false);
  });

  it('returns false when opt-in disabled', () => {
    expect(shouldTriggerCheckIn('auto', makeAudit(), false)).toBe(false);
  });

  it('returns false when reviewed within 30 days', () => {
    const audit = makeAudit({ lastReviewedAt: '2025-02-15T00:00:00Z' });
    expect(shouldTriggerCheckIn('auto', audit, true)).toBe(false);
  });

  it('returns false when within snooze period', () => {
    const audit = makeAudit({
      lastReviewedAt: '2024-12-01T00:00:00Z',
      lastDeferredAt: '2025-02-28T00:00:00Z',
    });
    expect(shouldTriggerCheckIn('auto', audit, true)).toBe(false);
  });

  it('returns true when null audit record', () => {
    expect(shouldTriggerCheckIn('auto', null, true)).toBe(true);
  });

  it('returns true when deferred but snooze expired', () => {
    const audit = makeAudit({
      lastReviewedAt: '2024-12-01T00:00:00Z',
      lastDeferredAt: '2025-02-20T00:00:00Z',
    });
    expect(shouldTriggerCheckIn('auto', audit, true)).toBe(true);
  });

  it('returns true when max deferrals reached and snooze expired', () => {
    const audit = makeAudit({
      lastReviewedAt: '2024-12-01T00:00:00Z',
      deferredCount: 3,
      lastDeferredAt: '2025-02-20T00:00:00Z',
    });
    expect(shouldTriggerCheckIn('auto', audit, true)).toBe(true);
  });

  it('returns false when max deferrals and within snooze', () => {
    const audit = makeAudit({
      lastReviewedAt: '2024-12-01T00:00:00Z',
      deferredCount: 3,
      lastDeferredAt: '2025-02-28T00:00:00Z',
    });
    expect(shouldTriggerCheckIn('auto', audit, true)).toBe(false);
  });

  it('uses createdAt when lastReviewedAt is null', () => {
    const audit = makeAudit({ createdAt: '2024-12-01T00:00:00Z' });
    expect(shouldTriggerCheckIn('auto', audit, true)).toBe(true);
  });
});

describe('scheduleNextCheckIn', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns now + 30 days when audit is null', () => {
    const result = scheduleNextCheckIn(null, 'UTC');
    expect(result.getTime()).toBeGreaterThan(Date.now());
    const diffDays = (result.getTime() - Date.now()) / 86_400_000;
    expect(diffDays).toBeGreaterThanOrEqual(29);
    expect(diffDays).toBeLessThanOrEqual(31);
  });

  it('calculates based on lastDeferredAt when present', () => {
    const audit = makeAudit({
      lastDeferredAt: '2025-02-28T00:00:00Z',
    });
    const result = scheduleNextCheckIn(audit, 'UTC');
    const diffDays = (result.getTime() - Date.now()) / 86_400_000;
    expect(diffDays).toBeGreaterThanOrEqual(5);
    expect(diffDays).toBeLessThanOrEqual(9);
  });

  it('calculates based on lastReviewedAt when no deferral', () => {
    const audit = makeAudit({
      lastReviewedAt: '2025-02-01T00:00:00Z',
    });
    const result = scheduleNextCheckIn(audit, 'UTC');
    expect(result.getTime()).toBeGreaterThan(Date.now());
  });

  it('uses createdAt when lastReviewedAt is null', () => {
    const audit = makeAudit({ createdAt: '2025-02-01T00:00:00Z' });
    const result = scheduleNextCheckIn(audit, 'UTC');
    expect(result).toBeInstanceOf(Date);
  });
});

describe('isMaxDeferralsReached', () => {
  it('returns true when count equals MAX_DEFERRALS', () => {
    expect(isMaxDeferralsReached(MAX_DEFERRALS)).toBe(true);
  });

  it('returns true when count exceeds MAX_DEFERRALS', () => {
    expect(isMaxDeferralsReached(MAX_DEFERRALS + 1)).toBe(true);
  });

  it('returns false when count below MAX_DEFERRALS', () => {
    expect(isMaxDeferralsReached(0)).toBe(false);
    expect(isMaxDeferralsReached(1)).toBe(false);
    expect(isMaxDeferralsReached(2)).toBe(false);
  });
});

describe('constants', () => {
  it('has correct values', () => {
    expect(REVIEW_ITEMS_MIN).toBe(5);
    expect(REVIEW_ITEMS_MAX).toBe(10);
    expect(REVIEW_ITEMS_DEFAULT).toBe(7);
    expect(SNOOZE_DAYS).toBe(7);
    expect(MAX_DEFERRALS).toBe(3);
    expect(AUTO_REVIEW_INTERVAL_DAYS).toBe(30);
    expect(AUTO_ACTION_LOOKBACK_DAYS).toBe(7);
    expect(AUTO_DISMISS_MS).toBe(20_000);
  });
});
