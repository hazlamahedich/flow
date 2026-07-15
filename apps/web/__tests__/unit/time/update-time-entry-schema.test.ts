import { describe, test, expect } from 'vitest';
import { updateTimeEntrySchema } from '../../../app/(workspace)/time/actions/update-time-entry';

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-0000-0000-000000000099',
    date: '2026-05-12',
    durationMinutes: 480,
    clientId: '00000000-0000-0000-0000-000000000001',
    projectId: null,
    notes: null,
    ...overrides,
  };
}

describe('updateTimeEntrySchema', () => {
  test('U1: accepts valid update with times', () => {
    const result = updateTimeEntrySchema.safeParse(
      baseInput({ startMinutes: 540, endMinutes: 1020 }),
    );
    expect(result.success).toBe(true);
  });

  test('U2: accepts clearing times', () => {
    const result = updateTimeEntrySchema.safeParse(
      baseInput({ startMinutes: null, endMinutes: null }),
    );
    expect(result.success).toBe(true);
  });

  test('U3: accepts absent times', () => {
    const result = updateTimeEntrySchema.safeParse(baseInput());
    expect(result.success).toBe(true);
  });

  test('U4: rejects start only', () => {
    const result = updateTimeEntrySchema.safeParse(
      baseInput({ startMinutes: 540 }),
    );
    expect(result.success).toBe(false);
  });

  test('U5: rejects end only', () => {
    const result = updateTimeEntrySchema.safeParse(
      baseInput({ endMinutes: 1020 }),
    );
    expect(result.success).toBe(false);
  });

  test('U6: rejects end before start', () => {
    const result = updateTimeEntrySchema.safeParse(
      baseInput({ startMinutes: 1020, endMinutes: 540 }),
    );
    expect(result.success).toBe(false);
  });

  test('U7: rejects start out of range', () => {
    const result = updateTimeEntrySchema.safeParse(
      baseInput({ startMinutes: -1, endMinutes: 540 }),
    );
    expect(result.success).toBe(false);
  });

  test('U8: rejects end out of range', () => {
    const result = updateTimeEntrySchema.safeParse(
      baseInput({ startMinutes: 540, endMinutes: 1500 }),
    );
    expect(result.success).toBe(false);
  });

  test('U9: rejects midnight-spanning', () => {
    const result = updateTimeEntrySchema.safeParse(
      baseInput({ startMinutes: 1380, endMinutes: 1439, durationMinutes: 120 }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message.includes('midnight')),
      ).toBe(true);
    }
  });
});
