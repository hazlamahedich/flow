/**
 * Zod schemas for portal action inputs.
 *
 * Story 9.1a — FR8, FR51, FR54.
 */
import { z } from 'zod';
import { PORTAL_TOKEN_TTL_MAX_HOURS } from './constants';

/**
 * Portal tokens are base64url-encoded 32-byte values (~43 chars).
 * The schema rejects tampered strings before any DB lookup (EC6).
 */
export const portalTokenSchema = z.object({
  token: z
    .string()
    .min(16, 'Token too short')
    .max(128, 'Token too long')
    .regex(/^[A-Za-z0-9_-]+$/, 'Token contains invalid characters'),
  clientId: z.string().uuid(),
});

export const generatePortalLinkSchema = z.object({
  clientId: z.string().uuid(),
  ttlHours: z.number().int().min(1).max(PORTAL_TOKEN_TTL_MAX_HOURS).optional(),
});

export const revokePortalTokenSchema = z.object({
  tokenId: z.string().uuid(),
});
