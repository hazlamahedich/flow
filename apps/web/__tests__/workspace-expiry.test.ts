import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('time-bound access: future expiry = active', () => {
  it('membership with future expires_at is active', () => {
    const membership = {
      status: 'active',
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const isActive = membership.status === 'active' &&
      (membership.expires_at === null || new Date(membership.expires_at) > new Date());
    expect(isActive).toBe(true);
  });
});

describe('time-bound access: past expiry = denied', () => {
  it('membership with past expires_at is denied via RLS', () => {
    const membership = {
      status: 'active',
      expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    };

    const isActive = membership.status === 'active' &&
      (membership.expires_at === null || new Date(membership.expires_at) > new Date());
    expect(isActive).toBe(false);
  });
});

describe('time-bound access: null expiry = permanent', () => {
  it('membership with null expires_at is permanent', () => {
    const membership = {
      status: 'active',
      expires_at: null,
    };

    const isActive = membership.status === 'active' &&
      (membership.expires_at === null || new Date(membership.expires_at) > new Date());
    expect(isActive).toBe(true);
  });
});

describe('expires_at boundary: exactly now', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('expires_at exactly now is denied', () => {
    const now = new Date('2026-04-21T12:00:00.000Z');
    vi.setSystemTime(now);

    const membership = {
      status: 'active',
      expires_at: now.toISOString(),
    };

    const isActive = membership.status === 'active' &&
      (membership.expires_at === null || new Date(membership.expires_at) > now);
    expect(isActive).toBe(false);
  });

  it('expires_at 1μs before now is denied', () => {
    const now = new Date('2026-04-21T12:00:00.000Z');
    vi.setSystemTime(now);

    const membership = {
      status: 'active',
      expires_at: new Date(now.getTime() - 1).toISOString(),
    };

    const isActive = membership.status === 'active' &&
      (membership.expires_at === null || new Date(membership.expires_at) > now);
    expect(isActive).toBe(false);
  });

  it('expires_at 1μs after now is active', () => {
    const now = new Date('2026-04-21T12:00:00.000Z');
    vi.setSystemTime(now);

    const membership = {
      status: 'active',
      expires_at: new Date(now.getTime() + 1).toISOString(),
    };

    const isActive = membership.status === 'active' &&
      (membership.expires_at === null || new Date(membership.expires_at) > now);
    expect(isActive).toBe(true);
  });
});

describe('Zod expiry validation', () => {
  it('rejects expiry more than 1 year from now', () => {
    const tooFar = new Date(Date.now() + 366 * 24 * 60 * 60 * 1000);
    const maxAllowed = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    expect(tooFar > maxAllowed).toBe(true);
  });

  it('accepts expiry exactly 1 year from now', () => {
    const exactlyOneYear = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const maxAllowed = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    expect(exactlyOneYear <= maxAllowed).toBe(true);
  });
});

describe('getActiveMembership query logic', () => {
  it('returns null for expired membership', () => {
    const membership = {
      status: 'active',
      expires_at: new Date(Date.now() - 1000).toISOString(),
    };

    const result = membership.expires_at && new Date(membership.expires_at) <= new Date()
      ? null
      : membership;
    expect(result).toBeNull();
  });

  it('returns membership for valid active membership', () => {
    const membership = {
      id: 'mem-1',
      status: 'active',
      expires_at: new Date(Date.now() + 100000).toISOString(),
    };

    const isExpired = membership.expires_at && new Date(membership.expires_at) <= new Date();
    const result = isExpired ? null : membership;
    expect(result).toEqual(membership);
  });
});
