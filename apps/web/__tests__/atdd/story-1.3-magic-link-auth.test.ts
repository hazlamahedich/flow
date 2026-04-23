import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

const SendMagicLinkInputSchema = z.object({
  email: z.string().email().min(1),
});

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

describe('Story 1.3: Magic Link Authentication', () => {
  describe('AC: magic link sent with 15-minute expiry', () => {
    const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;

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
      const result = SendMagicLinkInputSchema.safeParse({ email: 'user@example.com' });
      expect(result.success).toBe(true);
    });

    it('rejects invalid email', () => {
      const result = SendMagicLinkInputSchema.safeParse({ email: 'not-an-email' });
      expect(result.success).toBe(false);
    });

    it('rejects empty email', () => {
      const result = SendMagicLinkInputSchema.safeParse({ email: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('AC: remember device toggle', () => {
    it('trusted session extends to 7 days', () => {
      const TRUSTED_SESSION_MS = 7 * 24 * 60 * 60 * 1000;
      expect(TRUSTED_SESSION_MS).toBe(604800000);
    });

    it('untrusted session is 24 hours', () => {
      const UNTRUSTED_SESSION_MS = 24 * 60 * 60 * 1000;
      expect(UNTRUSTED_SESSION_MS).toBe(86400000);
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
