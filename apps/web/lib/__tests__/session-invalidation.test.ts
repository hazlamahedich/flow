import { describe, it, expect } from 'vitest';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('session invalidation', () => {
  it('validates UUID format correctly', () => {
    expect(UUID_REGEX.test('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true);
    expect(UUID_REGEX.test('not-a-uuid')).toBe(false);
    expect(UUID_REGEX.test('')).toBe(false);
    expect(UUID_REGEX.test('12345')).toBe(false);
  });
});
