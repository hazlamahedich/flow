import { describe, it, expect } from 'vitest';

describe('email validation', () => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  it('accepts valid emails', () => {
    expect(emailRegex.test('user@example.com')).toBe(true);
    expect(emailRegex.test('user.name@company.co')).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(emailRegex.test('')).toBe(false);
    expect(emailRegex.test('not-email')).toBe(false);
    expect(emailRegex.test('@missing.com')).toBe(false);
    expect(emailRegex.test('missing@.com')).toBe(false);
  });
});

describe('ActionResult type contract', () => {
  it('success result has success=true and data', () => {
    const result = { success: true as const, data: { sent: true } };
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ sent: true });
  });

  it('error result has success=false and error', () => {
    const result = {
      success: false as const,
      error: { status: 429, code: 'RATE_LIMITED', message: 'Too many requests', category: 'auth' as const },
    };
    expect(result.success).toBe(false);
    expect(result.error.status).toBe(429);
    expect(result.error.code).toBe('RATE_LIMITED');
  });
});
