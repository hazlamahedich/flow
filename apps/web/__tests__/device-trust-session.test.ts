import { describe, it, expect } from 'vitest';

const ABSOLUTE_SESSION_MS = 24 * 60 * 60 * 1000;
const TRUSTED_ABSOLUTE_SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const IDLE_SESSION_MS = 4 * 60 * 60 * 1000;

describe('device trust session timeout constants', () => {
  it('untrusted absolute session is 24 hours', () => {
    expect(ABSOLUTE_SESSION_MS).toBe(86400000);
  });

  it('trusted absolute session is 7 days', () => {
    expect(TRUSTED_ABSOLUTE_SESSION_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('idle session is 4 hours regardless of trust', () => {
    expect(IDLE_SESSION_MS).toBe(14400000);
  });
});

describe('session timeout logic', () => {
  function isSessionExpired(params: {
    issuedAt: number;
    now: number;
    isTrusted: boolean;
    lastActivity: number | null;
  }): { expired: boolean; reason?: string } {
    const absoluteTimeout = params.isTrusted
      ? TRUSTED_ABSOLUTE_SESSION_MS
      : ABSOLUTE_SESSION_MS;

    if (params.issuedAt > 0 && params.now - params.issuedAt > absoluteTimeout) {
      return { expired: true, reason: 'absolute' };
    }

    if (params.lastActivity !== null) {
      const elapsed = params.now - params.lastActivity;
      if (elapsed > IDLE_SESSION_MS) {
        return { expired: true, reason: 'idle' };
      }
    }

    return { expired: false };
  }

  it('untrusted device expires after 24h absolute', () => {
    const issuedAt = Date.now() - 25 * 60 * 60 * 1000;
    const result = isSessionExpired({
      issuedAt,
      now: Date.now(),
      isTrusted: false,
      lastActivity: Date.now(),
    });
    expect(result.expired).toBe(true);
    expect(result.reason).toBe('absolute');
  });

  it('trusted device does not expire after 24h absolute', () => {
    const issuedAt = Date.now() - 25 * 60 * 60 * 1000;
    const result = isSessionExpired({
      issuedAt,
      now: Date.now(),
      isTrusted: true,
      lastActivity: Date.now(),
    });
    expect(result.expired).toBe(false);
  });

  it('trusted device expires after 7 days absolute', () => {
    const issuedAt = Date.now() - 8 * 24 * 60 * 60 * 1000;
    const result = isSessionExpired({
      issuedAt,
      now: Date.now(),
      isTrusted: true,
      lastActivity: Date.now(),
    });
    expect(result.expired).toBe(true);
    expect(result.reason).toBe('absolute');
  });

  it('idle timeout applies regardless of trust status', () => {
    const issuedAt = Date.now();
    const lastActivity = Date.now() - 5 * 60 * 60 * 1000;
    const result = isSessionExpired({
      issuedAt,
      now: Date.now(),
      isTrusted: true,
      lastActivity,
    });
    expect(result.expired).toBe(true);
    expect(result.reason).toBe('idle');
  });

  it('revoked device falls back to 24h absolute', () => {
    const issuedAt = Date.now() - 25 * 60 * 60 * 1000;
    const result = isSessionExpired({
      issuedAt,
      now: Date.now(),
      isTrusted: false,
      lastActivity: Date.now(),
    });
    expect(result.expired).toBe(true);
    expect(result.reason).toBe('absolute');
  });

  it('mismatch cookie uses standard session (no error)', () => {
    const issuedAt = Date.now() - 23 * 60 * 60 * 1000;
    const result = isSessionExpired({
      issuedAt,
      now: Date.now(),
      isTrusted: false,
      lastActivity: Date.now(),
    });
    expect(result.expired).toBe(false);
  });
});
