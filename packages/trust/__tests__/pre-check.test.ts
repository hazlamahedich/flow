import { describe, it, expect } from 'vitest';
import { evaluatePreconditions } from '../src/pre-check';
import type { PreconditionEntry } from '../src/pre-check';

function makePrecondition(overrides: Partial<PreconditionEntry> = {}): PreconditionEntry {
  return {
    condition_key: 'client_status',
    condition_expr: 'active',
    is_active: true,
    ...overrides,
  };
}

describe('evaluatePreconditions', () => {
  it('passes when all preconditions match', () => {
    const result = evaluatePreconditions(
      [makePrecondition()],
      { client_status: 'active' },
    );
    expect(result.passed).toBe(true);
    expect(result.failedKey).toBeUndefined();
  });

  it('fails when single precondition does not match', () => {
    const result = evaluatePreconditions(
      [makePrecondition()],
      { client_status: 'inactive' },
    );
    expect(result.passed).toBe(false);
    expect(result.failedKey).toBe('client_status');
  });

  it('fails on first failing precondition with multiple', () => {
    const result = evaluatePreconditions(
      [
        makePrecondition({ condition_key: 'client_status', condition_expr: 'active' }),
        makePrecondition({ condition_key: 'time_of_day', condition_expr: 'business_hours' }),
      ],
      { client_status: 'active', time_of_day: 'after_hours' },
    );
    expect(result.passed).toBe(false);
    expect(result.failedKey).toBe('time_of_day');
  });

  it('skips inactive preconditions', () => {
    const result = evaluatePreconditions(
      [makePrecondition({ is_active: false })],
      { client_status: 'inactive' },
    );
    expect(result.passed).toBe(true);
  });

  it('passes with empty preconditions array', () => {
    const result = evaluatePreconditions([], { anything: 'value' });
    expect(result.passed).toBe(true);
  });

  it('passes vacuously with null context', () => {
    const result = evaluatePreconditions([makePrecondition()], null);
    expect(result.passed).toBe(true);
  });
});
