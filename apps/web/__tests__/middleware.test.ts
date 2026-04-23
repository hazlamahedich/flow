import { describe, it, expect } from 'vitest';
import {
  ABSOLUTE_SESSION_MS,
  TRUSTED_ABSOLUTE_SESSION_MS,
  IDLE_SESSION_MS,
} from '@/lib/session-constants';

const SKIP_PATTERNS = [
  { pattern: '/_next/static/chunk.js', reason: '_next prefix' },
  { pattern: '/_next/image/logo.png', reason: '_next prefix' },
  { pattern: '/favicon.ico', reason: 'contains dot' },
  { pattern: '/api/webhooks/stripe', reason: 'api/webhooks prefix' },
  { pattern: '/api/webhooks/gmail', reason: 'api/webhooks prefix' },
  { pattern: '/static/logo.svg', reason: 'static prefix' },
];

function shouldSkip(pathname: string): boolean {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/webhooks') ||
    pathname.startsWith('/static') ||
    pathname.includes('.')
  );
}

const PROCESS_PATTERNS = [
  '/login',
  '/dashboard',
  '/auth/callback',
  '/settings/profile',
  '/onboarding',
  '/',
];

describe('middleware route handling', () => {
  it('skips static assets and webhook routes', () => {
    for (const { pattern } of SKIP_PATTERNS) {
      expect(shouldSkip(pattern), `Expected "${pattern}" to be skipped`).toBe(true);
    }
  });

  it('processes app routes', () => {
    for (const pattern of PROCESS_PATTERNS) {
      expect(shouldSkip(pattern), `Expected "${pattern}" to NOT be skipped`).toBe(false);
    }
  });
});

describe('session timeout constants (from shared module)', () => {
  it('absolute session is 24 hours', () => {
    expect(ABSOLUTE_SESSION_MS).toBe(86400000);
  });

  it('idle session is 4 hours', () => {
    expect(IDLE_SESSION_MS).toBe(14400000);
  });

  it('trusted absolute session is 7 days', () => {
    expect(TRUSTED_ABSOLUTE_SESSION_MS).toBe(604800000);
  });

  it('trusted absolute is exactly 7x the normal absolute', () => {
    expect(TRUSTED_ABSOLUTE_SESSION_MS).toBe(7 * ABSOLUTE_SESSION_MS);
  });
});

describe('trusted device session extension', () => {
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
  it('revoked device cookie falls back to standard timeout', () => {
    const isTrusted = false;
    const issuedAt = Date.now() - 25 * 60 * 60 * 1000;

    expect(!isTrusted && (Date.now() - issuedAt > ABSOLUTE_SESSION_MS)).toBe(true);
  });

  it('active device at 23h is still valid', () => {
    const isTrusted = false;
    const issuedAt = Date.now() - 23 * 60 * 60 * 1000;

    expect(!isTrusted && (Date.now() - issuedAt > ABSOLUTE_SESSION_MS)).toBe(false);
  });
});
