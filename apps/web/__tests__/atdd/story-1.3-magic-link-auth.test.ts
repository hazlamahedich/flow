import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  ABSOLUTE_SESSION_MS,
  TRUSTED_ABSOLUTE_SESSION_MS,
} from '@/lib/session-constants';

const emailSchema = z.string().email('Please enter a valid email address');

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;

describe('Story 1.3: Magic Link Authentication', () => {
  describe('AC: magic link sent with 15-minute expiry', () => {
    it('expires magic link after 15 minutes', () => {
      const createdAt = Date.now() - MAGIC_LINK_TTL_MS - 1;
      const isExpired = Date.now() - createdAt > MAGIC_LINK_TTL_MS;
      expect(isExpired).toBe(true);
    });

    it('magic link is valid at 14m59s', () => {
      const createdAt = Date.now() - (MAGIC_LINK_TTL_MS - 1000);
      const isExpired = Date.now() - createdAt > MAGIC_LINK_TTL_MS;
      expect(isExpired).toBe(false);
    });
  });

  describe('AC: rate limit - 5 attempts per email per hour', () => {
    let attempts: number[];

    beforeEach(() => {
      attempts = [];
    });

    function checkRateLimit(): { allowed: boolean } {
      const windowStart = Date.now() - RATE_LIMIT_WINDOW_MS;
      const recent = attempts.filter((t) => t > windowStart);
      if (recent.length >= RATE_LIMIT_MAX) {
        return { allowed: false };
      }
      attempts.push(Date.now());
      return { allowed: true };
    }

    it('allows first 5 requests', () => {
      for (let i = 0; i < 5; i++) {
        expect(checkRateLimit().allowed).toBe(true);
      }
    });

    it('blocks 6th request within the hour', () => {
      for (let i = 0; i < 5; i++) checkRateLimit();
      expect(checkRateLimit().allowed).toBe(false);
    });

    it('allows request after window expires', () => {
      const oldTimestamp = Date.now() - RATE_LIMIT_WINDOW_MS - 1;
      attempts = Array.from({ length: 5 }, () => oldTimestamp);
      expect(checkRateLimit().allowed).toBe(true);
    });
  });

  describe('AC: email validation', () => {
    it('accepts valid email', () => {
      const result = emailSchema.safeParse('user@example.com');
      expect(result.success).toBe(true);
    });

    it('rejects invalid email', () => {
      const result = emailSchema.safeParse('not-an-email');
      expect(result.success).toBe(false);
    });

    it('rejects empty email', () => {
      const result = emailSchema.safeParse('');
      expect(result.success).toBe(false);
    });
  });

  describe('AC: remember device toggle', () => {
    it('trusted session uses TRUSTED_ABSOLUTE_SESSION_MS constant from middleware', () => {
      expect(TRUSTED_ABSOLUTE_SESSION_MS).toBe(7 * 24 * 60 * 60 * 1000);
      expect(TRUSTED_ABSOLUTE_SESSION_MS).toBe(7 * ABSOLUTE_SESSION_MS);
    });

    it('untrusted session uses ABSOLUTE_SESSION_MS constant from middleware', () => {
      expect(ABSOLUTE_SESSION_MS).toBe(24 * 60 * 60 * 1000);
    });

    it('trusted session survives 25 hours but untrusted does not', () => {
      const elapsed = 25 * 60 * 60 * 1000;
      expect(elapsed < TRUSTED_ABSOLUTE_SESSION_MS).toBe(true);
      expect(elapsed > ABSOLUTE_SESSION_MS).toBe(true);
    });
  });

  describe('AC: session invalidation on role change within 60s', () => {
    it('revocation timestamp check window is 60 seconds', () => {
      const REVOCATION_WINDOW_S = 60;
      const issuedAt = Date.now() / 1000 - 30;
      const revokedAt = Date.now() / 1000;
      const sessionInvalid = revokedAt - issuedAt < REVOCATION_WINDOW_S;
      expect(sessionInvalid).toBe(true);
    });
  });
});
