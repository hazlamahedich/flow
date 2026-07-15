/**
 * Internal helpers used by portal Server Actions.
 *
 * Story 9.1a — FR8, FR51, FR54.
 */
'use server';

import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { z } from 'zod';
import { createFlowError } from '@flow/db';
import type { FlowError } from '@flow/types';

/**
 * Canonical shape of a successfully verified/validated portal context.
 */
export interface PortalContext {
  clientId: string;
  workspaceId: string;
  portalTokenId: string;
}

/** Wrap a FlowError into the ActionResult failure shape. */
export function failure(error: FlowError): {
  success: false;
  error: FlowError;
} {
  return { success: false, error };
}

/** sha256 hex hash — mirrors `hashDeviceToken` in @flow/auth/device-trust. */
export function hashPortalToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Base64url encoding without padding (URL-safe magic-link tokens). */
export function encodeBase64Url(bytes: Buffer): string {
  return bytes.toString('base64url');
}

/** Resolve the public app URL from env. */
export function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000')
  );
}

/**
 * Build the magic-link redemption URL.
 * Format: `${APP_URL}/portal/redeem?token=<plaintext>&slug=<slug>`.
 */
export function buildPortalRedeemUrl(
  plaintextToken: string,
  slug: string,
): string {
  const params = new URLSearchParams({
    token: plaintextToken,
    slug,
  });
  return `${getAppUrl()}/portal/redeem?${params.toString()}`;
}

/** Sanitize a workspace slug so it can safely be used in a redirect path. */
export function sanitizeSlug(slug: string | undefined): string | null {
  if (!slug) return null;
  const trimmed = slug.trim();
  // Slugs are lowercase alphanumerics with hyphens; reject anything else.
  if (!/^[a-z0-9-]+$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Validate the rate-limit RPC result.
 *
 * The `check_rate_limit` RPC returns `{ allowed: boolean, retry_after_ms: number }`.
 * We fail OPEN for null/unexpected shapes because project-context.md:114 states
 * rate-limiting is best-effort and failures should allow the request through.
 * Only an explicit `allowed: false` denies the request.
 */
export function isRateLimited(
  rlResult: unknown,
): { limited: true; retryAfterMs: number } | { limited: false } {
  if (
    rlResult === null ||
    typeof rlResult !== 'object' ||
    Array.isArray(rlResult)
  ) {
    return { limited: false };
  }

  const result = rlResult as { allowed?: unknown; retry_after_ms?: unknown };

  if (result.allowed === false) {
    const retryAfterMs =
      typeof result.retry_after_ms === 'number' ? result.retry_after_ms : 0;
    return { limited: true, retryAfterMs };
  }

  return { limited: false };
}

/**
 * Best-effort IP extraction for rate limiting. Prefers the last value of
 * `x-forwarded-for` (the one appended by the closest trusted proxy) when
 * multiple hops are present, falls back to `x-real-ip`, then 'anonymous'.
 *
 * Rationale: the first entry in X-Forwarded-For is the client-controlled
 * original IP and can be spoofed. The last entry is the one added by the
 * closest trusted proxy (e.g. Vercel/Vercel edge, Cloudflare) and is more
 * reliable. We still treat rate-limiting as best-effort per
 * project-context.md:114 — failures allow the request through only when
 * headers are genuinely unavailable.
 */
export async function getIpIdentifier(): Promise<string> {
  try {
    const h = await headers();
    const forwarded = h.get('x-forwarded-for');
    if (forwarded) {
      const parts = forwarded.split(',').map((s) => s.trim());
      const last = parts[parts.length - 1];
      if (last) return last;
    }
    return h.get('x-real-ip') ?? 'anonymous';
  } catch {
    return 'anonymous';
  }
}

/**
 * Create a FlowError for rate-limit violations.
 */
export function createRateLimitError(retryAfterMs: number): FlowError {
  return createFlowError(
    429,
    'RATE_LIMITED',
    'Too many requests. Try again later.',
    'auth',
    { retryAfterMs },
  );
}

/** Validate a token string against the portal token format schema. */
export function validateTokenFormat(token: string): string | null {
  const schema = z
    .string()
    .min(16, 'Token too short')
    .max(128, 'Token too long')
    .regex(/^[A-Za-z0-9_-]+$/, 'Token contains invalid characters');

  const parsed = schema.safeParse(token);
  return parsed.success ? parsed.data : null;
}
