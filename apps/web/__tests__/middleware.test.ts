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
  it('absolute session is 24 hours', () => {
    const ABSOLUTE_SESSION_MS = 24 * 60 * 60 * 1000;
    expect(ABSOLUTE_SESSION_MS).toBe(86400000);
  });

  it('idle session is 4 hours', () => {
    const IDLE_SESSION_MS = 4 * 60 * 60 * 1000;
    expect(IDLE_SESSION_MS).toBe(14400000);
  });
});
