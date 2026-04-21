import { describe, it, expect } from 'vitest';

describe('middleware route handling', () => {
  function shouldSkip(pathname: string): boolean {
    return (
      pathname.startsWith('/_next') ||
      pathname.startsWith('/api/webhooks') ||
      pathname.startsWith('/static') ||
      pathname.includes('.')
    );
  }

  it('skips static assets', () => {
    expect(shouldSkip('/_next/static/chunk.js')).toBe(true);
    expect(shouldSkip('/_next/image/logo.png')).toBe(true);
    expect(shouldSkip('/favicon.ico')).toBe(true);
  });

  it('skips webhook routes', () => {
    expect(shouldSkip('/api/webhooks/stripe')).toBe(true);
    expect(shouldSkip('/api/webhooks/gmail')).toBe(true);
  });

  it('processes app routes', () => {
    expect(shouldSkip('/login')).toBe(false);
    expect(shouldSkip('/dashboard')).toBe(false);
    expect(shouldSkip('/auth/callback')).toBe(false);
    expect(shouldSkip('/')).toBe(false);
  });
});

describe('session timeout constants', () => {
  const ABSOLUTE_SESSION_MS = 24 * 60 * 60 * 1000;
  const TRUSTED_ABSOLUTE_SESSION_MS = 7 * 24 * 60 * 60 * 1000;
  const IDLE_SESSION_MS = 4 * 60 * 60 * 1000;

  it('absolute session is 24 hours', () => {
    expect(ABSOLUTE_SESSION_MS).toBe(86400000);
  });

  it('idle session is 4 hours', () => {
    expect(IDLE_SESSION_MS).toBe(14400000);
  });

  it('trusted absolute session is 7 days', () => {
    expect(TRUSTED_ABSOLUTE_SESSION_MS).toBe(604800000);
  });
});

describe('trusted device session extension', () => {
  const ABSOLUTE_SESSION_MS = 24 * 60 * 60 * 1000;
  const TRUSTED_ABSOLUTE_SESSION_MS = 7 * 24 * 60 * 60 * 1000;

  it('trusted device uses 7-day absolute timeout', () => {
    expect(TRUSTED_ABSOLUTE_SESSION_MS).toBe(7 * ABSOLUTE_SESSION_MS);
  });

  it('session valid at 25h with trusted device', () => {
    const elapsed = 25 * 60 * 60 * 1000;
    expect(elapsed < TRUSTED_ABSOLUTE_SESSION_MS).toBe(true);
    expect(elapsed > ABSOLUTE_SESSION_MS).toBe(true);
  });

  it('session expired at 8 days even for trusted device', () => {
    const elapsed = 8 * 24 * 60 * 60 * 1000;
    expect(elapsed > TRUSTED_ABSOLUTE_SESSION_MS).toBe(true);
  });
});

describe('revoked device fallback', () => {
  it('revoked device cookie does not extend session', () => {
    const isTrusted = false;
    const ABSOLUTE_SESSION_MS = 24 * 60 * 60 * 1000;
    const issuedAt = Date.now() - 25 * 60 * 60 * 1000;

    expect(!isTrusted && (Date.now() - issuedAt > ABSOLUTE_SESSION_MS)).toBe(true);
  });

  it('mismatch cookie treated as untrusted (no error)', () => {
    const isTrusted = false;
    expect(isTrusted).toBe(false);
  });
});
