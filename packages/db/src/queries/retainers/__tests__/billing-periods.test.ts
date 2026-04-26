import { describe, it, expect } from 'vitest';
import { getCurrentBillingPeriod } from '../billing-periods';

describe('getCurrentBillingPeriod', () => {
  it('returns period containing reference date', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const ref = new Date('2026-01-15T00:00:00Z');
    const result = getCurrentBillingPeriod(start, 30, ref);

    expect(result.periodStart.toISOString().slice(0, 10)).toBe('2026-01-01');
    expect(result.periodEnd.toISOString().slice(0, 10)).toBe('2026-01-31');
  });

  it('handles exact period boundary (day 30)', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const ref = new Date('2026-01-31T00:00:00Z');
    const result = getCurrentBillingPeriod(start, 30, ref);

    expect(result.periodStart.toISOString().slice(0, 10)).toBe('2026-01-31');
    expect(result.periodEnd.toISOString().slice(0, 10)).toBe('2026-03-02');
  });

  it('handles second period', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const ref = new Date('2026-02-15T00:00:00Z');
    const result = getCurrentBillingPeriod(start, 30, ref);

    expect(result.periodStart.toISOString().slice(0, 10)).toBe('2026-01-31');
    expect(result.periodEnd.toISOString().slice(0, 10)).toBe('2026-03-02');
  });

  it('clamps future start_date to period 0', () => {
    const start = new Date('2026-06-01T00:00:00Z');
    const ref = new Date('2026-01-01T00:00:00Z');
    const result = getCurrentBillingPeriod(start, 30, ref);

    expect(result.periodStart.toISOString().slice(0, 10)).toBe('2026-06-01');
    expect(result.periodEnd.toISOString().slice(0, 10)).toBe('2026-07-01');
  });

  it('handles same-day start and reference', () => {
    const start = new Date('2026-03-15T00:00:00Z');
    const ref = new Date('2026-03-15T00:00:00Z');
    const result = getCurrentBillingPeriod(start, 30, ref);

    expect(result.periodStart.toISOString().slice(0, 10)).toBe('2026-03-15');
    expect(result.periodEnd.toISOString().slice(0, 10)).toBe('2026-04-14');
  });

  it('handles leap year (Feb 29 start + 30-day periods)', () => {
    const start = new Date('2024-02-29T00:00:00Z');
    const ref = new Date('2024-03-30T00:00:00Z');
    const result = getCurrentBillingPeriod(start, 30, ref);

    expect(result.periodStart.toISOString().slice(0, 10)).toBe('2024-03-30');
    expect(result.periodEnd.toISOString().slice(0, 10)).toBe('2024-04-29');
  });

  it('handles non-divisible periods (31-day from Jan 1)', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const ref = new Date('2026-02-01T00:00:00Z');
    const result = getCurrentBillingPeriod(start, 31, ref);

    expect(result.periodStart.toISOString().slice(0, 10)).toBe('2026-02-01');
    expect(result.periodEnd.toISOString().slice(0, 10)).toBe('2026-03-04');
  });

  it('handles period drift (30-day from Jan 31)', () => {
    const start = new Date('2026-01-31T00:00:00Z');
    const ref = new Date('2026-03-01T00:00:00Z');
    const result = getCurrentBillingPeriod(start, 30, ref);

    expect(result.periodStart.toISOString().slice(0, 10)).toBe('2026-01-31');
    expect(result.periodEnd.toISOString().slice(0, 10)).toBe('2026-03-02');
  });

  it('handles very long period (365 days)', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const ref = new Date('2026-06-15T00:00:00Z');
    const result = getCurrentBillingPeriod(start, 365, ref);

    expect(result.periodStart.toISOString().slice(0, 10)).toBe('2026-01-01');
    expect(result.periodEnd.toISOString().slice(0, 10)).toBe('2027-01-01');
  });

  it('handles exactly one period elapsed', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const ref = new Date('2026-02-01T00:00:00Z');
    const result = getCurrentBillingPeriod(start, 31, ref);

    expect(result.periodStart.toISOString().slice(0, 10)).toBe('2026-02-01');
  });

  it('handles last day of period', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const ref = new Date('2026-01-29T00:00:00Z');
    const result = getCurrentBillingPeriod(start, 30, ref);

    expect(result.periodStart.toISOString().slice(0, 10)).toBe('2026-01-01');
  });

  it('handles period rollover at exact boundary', () => {
    const start = new Date('2026-01-01T00:00:00Z');
    const ref = new Date('2026-01-30T00:00:00Z');
    const result = getCurrentBillingPeriod(start, 30, ref);

    expect(result.periodStart.toISOString().slice(0, 10)).toBe('2026-01-01');
  });

  it('handles 7-day periods correctly', () => {
    const start = new Date('2026-01-06T00:00:00Z');
    const ref = new Date('2026-01-20T00:00:00Z');
    const result = getCurrentBillingPeriod(start, 7, ref);

    expect(result.periodStart.toISOString().slice(0, 10)).toBe('2026-01-20');
  });

  it('uses UTC date-only comparison (no timezone drift)', () => {
    const start = new Date('2026-01-01T23:00:00Z');
    const ref = new Date('2026-01-15T01:00:00Z');
    const result = getCurrentBillingPeriod(start, 30, ref);

    expect(result.periodStart.toISOString().slice(0, 10)).toBe('2026-01-01');
  });
});
