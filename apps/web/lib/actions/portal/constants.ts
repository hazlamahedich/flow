/**
 * Portal auth constants shared across actions and helpers.
 *
 * Story 9.1a — FR8, FR51, FR54.
 */

/** Crypto-random byte count for portal tokens. ≥32 bytes (FR8 abuse prevention). */
export const PORTAL_TOKEN_BYTES = 32;

/** Magic-link token TTL in hours (default). Bounded to PORTAL_TOKEN_TTL_MAX_HOURS. */
export const PORTAL_TOKEN_TTL_HOURS = 72;

/** Magic-link token TTL hard cap (project-context.md:471). */
export const PORTAL_TOKEN_TTL_MAX_HOURS = 168;

/** Portal session cookie TTL (24h absolute — project-context.md:471). */
export const PORTAL_SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;

/** Portal session cookie name. HttpOnly; Secure; SameSite=Lax; Path=/. */
export const PORTAL_COOKIE_NAME = '__flow_portal';

/** Rate-limit: max link generations per email/client per hour. */
export const PORTAL_LINK_RATE_LIMIT_PER_HOUR = 5;

/** Rate-limit: max token validations per IP per hour. */
export const PORTAL_TOKEN_RATE_LIMIT_PER_HOUR = 20;

/** Workspaces without a custom slug fall back to this placeholder label. */
export const PORTAL_SLUG_PLACEHOLDER = 'unknown';
