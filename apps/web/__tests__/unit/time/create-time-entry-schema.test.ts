import { describe, test, expect } from 'vitest';
import { createTimeEntrySchema } from '../../../app/(workspace)/time/actions/create-time-entry';

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    clientId: '00000000-0000-0000-0000-000000000001',
    projectId: null,
    date: '2026-05-12',
    durationMinutes: 480,
    ...overrides,
  };
}

describe('createTimeEntrySchema', () => {
  test('S1: accepts valid with times', () => {
    const result = createTimeEntrySchema.safeParse(baseInput({ startMinutes: 540, endMinutes: 1020 }));
    expect(result.success).toBe(true);
  });

  test('S2: accepts valid without times', () => {
    const result = createTimeEntrySchema.safeParse(baseInput());
    expect(result.success).toBe(true);
  });

  test('S3: rejects start only', () => {
    const result = createTimeEntrySchema.safeParse(baseInput({ startMinutes: 540 }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('Both start and end'))).toBe(true);
    }
  });

  test('S4: rejects end only', () => {
    const result = createTimeEntrySchema.safeParse(baseInput({ endMinutes: 1020 }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('Both start and end'))).toBe(true);
    }
  });

  test('S5: rejects end before start', () => {
    const result = createTimeEntrySchema.safeParse(baseInput({ startMinutes: 1020, endMinutes: 540 }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('End time must be after start time'))).toBe(true);
    }
  });

  test('S6: rejects start = end', () => {
    const result = createTimeEntrySchema.safeParse(baseInput({ startMinutes: 540, endMinutes: 540 }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('End time must be after start time'))).toBe(true);
    }
  });

  test('S7: rejects start out of range', () => {
    const result = createTimeEntrySchema.safeParse(baseInput({ startMinutes: -1, endMinutes: 540 }));
    expect(result.success).toBe(false);
  });

  test('S8: rejects end out of range', () => {
    const result = createTimeEntrySchema.safeParse(baseInput({ startMinutes: 540, endMinutes: 1440 }));
    expect(result.success).toBe(false);
  });

  test('S9: rejects midnight-spanning', () => {
    const result = createTimeEntrySchema.safeParse(baseInput({ startMinutes: 1380, endMinutes: 1439, durationMinutes: 120 }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('midnight'))).toBe(true);
    }
  });
});
