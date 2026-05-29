import { describe, test, expect } from 'vitest';
import {
  computeEngagementScore,
  computePaymentScore,
  computeCommunicationScore,
  computeOverallHealth,
  computeIndicators,
  type HealthInput,
} from '../src/compute-health';

const fixture = (overrides: Partial<HealthInput> = {}): HealthInput => ({
  timeEntryHoursLast30d: 10,
  emailExchangeCount: 5,
  meetingCount: 2,
  overdueInvoiceCount: 0,
  daysSinceLastPayment: 0,
  avgResponseTimeHours: 2,
  meetingBypassCount: 0,
  daysSinceLastContact: 1,
  unpaidInvoiceCount: 0,
  timeEntryStreakDays: 5,
  lastInvoicePaidAt: '2026-05-20T00:00:00Z',
  clientCreatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('computeHealthScores — Engagement Score', () => {
  test('baseline: zero activity yields 20 (baseline only)', () => {
    const input = fixture({
      timeEntryHoursLast30d: 0,
      emailExchangeCount: 0,
      meetingCount: 0,
    });
    const score = computeEngagementScore(input);
    expect(score).toBe(20);
  });

  test('moderate activity: 10h time, 5 emails, 2 meetings = 80', () => {
    const input = fixture();
    const score = computeEngagementScore(input);
    expect(score).toBe(80);
  });

  test('capped at 100 for very high activity', () => {
    const input = fixture({
      timeEntryHoursLast30d: 100,
      emailExchangeCount: 100,
      meetingCount: 50,
    });
    const score = computeEngagementScore(input);
    expect(score).toBe(100);
  });
});

describe('computeHealthScores — Payment Score', () => {
  test('no invoices yields 100 (no payment issues)', () => {
    const input = fixture({ overdueInvoiceCount: 0, daysSinceLastPayment: 0 });
    const score = computePaymentScore(input);
    expect(score).toBe(100);
  });

  test('1 overdue invoice loses 15 points', () => {
    const input = fixture({ overdueInvoiceCount: 1, daysSinceLastPayment: 0 });
    const score = computePaymentScore(input);
    expect(score).toBe(85);
  });

  test('floor at 0 for very poor payment', () => {
    const input = fixture({ overdueInvoiceCount: 10, daysSinceLastPayment: 180 });
    const score = computePaymentScore(input);
    expect(score).toBe(0);
  });
});

describe('computeHealthScores — Communication Score', () => {
  test('low response time, no bypasses = 96', () => {
    const input = fixture({ avgResponseTimeHours: 2, meetingBypassCount: 0 });
    const score = computeCommunicationScore(input);
    expect(score).toBe(96);
  });

  test('high response time + bypasses degrades score', () => {
    const input = fixture({ avgResponseTimeHours: 20, meetingBypassCount: 5 });
    const score = computeCommunicationScore(input);
    expect(score).toBeLessThan(50);
  });

  test('floor at 0', () => {
    const input = fixture({ avgResponseTimeHours: 100, meetingBypassCount: 20 });
    const score = computeCommunicationScore(input);
    expect(score).toBe(0);
  });
});

// Fixed reference date for deterministic overall-health tests
const REF_DATE = new Date('2026-05-29T12:00:00Z');
// A "new" client created 3 days before reference date
const NEW_CLIENT_CREATED = '2026-05-26T00:00:00Z';
// An established client created long before reference date
const ESTABLISHED_CLIENT_CREATED = '2025-01-01T00:00:00Z';

describe('computeHealthScores — Overall Health Rules', () => {
  test('EC1a: newly created client (<14d) → onboarding', () => {
    const input = fixture({ clientCreatedAt: NEW_CLIENT_CREATED });
    const result = computeOverallHealth(80, 80, 80, input, REF_DATE);
    expect(result).toBe('onboarding');
  });

  test('any sub-score < 30 → critical', () => {
    const result = computeOverallHealth(25, 80, 80, fixture({ clientCreatedAt: ESTABLISHED_CLIENT_CREATED }), REF_DATE);
    expect(result).toBe('critical');
  });

  test('payment score < 40 → critical', () => {
    const result = computeOverallHealth(80, 35, 80, fixture({ clientCreatedAt: ESTABLISHED_CLIENT_CREATED }), REF_DATE);
    expect(result).toBe('critical');
  });

  test('any sub-score < 50 → at-risk', () => {
    const result = computeOverallHealth(45, 80, 80, fixture({ clientCreatedAt: ESTABLISHED_CLIENT_CREATED }), REF_DATE);
    expect(result).toBe('at-risk');
  });

  test('payment < 60 AND communication < 60 → at-risk', () => {
    const result = computeOverallHealth(80, 55, 55, fixture({ clientCreatedAt: ESTABLISHED_CLIENT_CREATED }), REF_DATE);
    expect(result).toBe('at-risk');
  });

  test('all scores >= 60 → healthy', () => {
    const result = computeOverallHealth(60, 60, 60, fixture({ clientCreatedAt: ESTABLISHED_CLIENT_CREATED }), REF_DATE);
    expect(result).toBe('healthy');
  });

  test('EC1: zero activity >14d — formula gives engagement=20, payment=100, communication=100 → critical', () => {
    // Note: AC3 "defaults to 50" applies when the DB query FAILS (EC9/graceful degradation),
    // not when valid zero-activity data is returned. Formula baseline is 20 (engagement-only floor).
    const input = fixture({
      timeEntryHoursLast30d: 0,
      emailExchangeCount: 0,
      meetingCount: 0,
      avgResponseTimeHours: 0,
      meetingBypassCount: 0,
      overdueInvoiceCount: 0,
      daysSinceLastPayment: 0,
      clientCreatedAt: ESTABLISHED_CLIENT_CREATED,
    });
    const eng = computeEngagementScore(input);
    const pay = computePaymentScore(input);
    const com = computeCommunicationScore(input);
    const overall = computeOverallHealth(eng, pay, com, input, REF_DATE);
    expect(eng).toBe(20); // baseline-only: formula produces 20, not 50
    expect(pay).toBe(100); // no invoices = no payment issues
    expect(com).toBe(100); // zero response time + zero bypasses
    // engagement=20 < 30 threshold triggers critical per AC3 rule
    expect(overall).toBe('critical');
  });

  test('EC9: graceful degradation — DB query failure defaults scores to 50 → at-risk', () => {
    // When a query fails, executor defaults scores to 50 (AC3: "gracefully defaults to 50").
    // computeOverallHealth with all-50: payment=50<60 AND communication=50<60 triggers at-risk rule.
    // "Neutral 50" refers to the score value (mid-range), not the health status — the rule still applies.
    const overall = computeOverallHealth(50, 50, 50, fixture({ clientCreatedAt: ESTABLISHED_CLIENT_CREATED }), REF_DATE);
    expect(overall).toBe('at-risk');
  });
});

describe('computeHealthScores — Indicators', () => {
  test('assembles correct indicator JSONB', () => {
    const input = fixture();
    const indicators = computeIndicators(input);
    expect(indicators).toEqual({
      days_since_last_contact: 1,
      unpaid_invoice_count: 0,
      time_entry_streak_days: 5,
      avg_response_time_hours: 2,
      meeting_bypass_count: 0,
      last_invoice_paid_at: '2026-05-20T00:00:00Z',
    });
  });
});
