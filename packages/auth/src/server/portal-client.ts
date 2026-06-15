/**
 * Portal session JWT signing + verification + scoped Supabase SSR client.
 *
 * Portal auth is a completely separate channel from workspace auth:
 *   - Workspace users → Supabase Auth session (auth.uid() populated, RLS via
 *     workspace_members + JWT app_metadata.workspace_id).
 *   - Portal clients   → Custom JWT signed with SUPABASE_JWT_SECRET, NO Supabase
 *     Auth session (auth.uid() is null, no auth.users row). RLS via portal role
 *     checking JWT claims (role, client_id, portal_token_id).
 *
 * The portal JWT lives in the `__flow_portal` HttpOnly cookie (24h absolute TTL).
 * The bearer token is sent via `Authorization: Bearer <jwt>` so Postgres sees
 * the claims through `request.jwt.claims` / `auth.jwt()`.
 *
 * Story 9.1a — FR51 (no account required), FR54 (strict isolation).
 */
import { SignJWT, jwtVerify, errors as joseErrors } from 'jose';
import { createServerClient as createSsrServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

const PORTAL_JWT_ALG = 'HS256';
const PORTAL_JWT_AUDIENCE = 'portal';
const PORTAL_JWT_ISSUER_DEFAULT = 'flow-os-portal';

export interface PortalClaims {
  clientId: string;
  workspaceId: string;
  portalTokenId: string;
}

export interface PortalSession extends PortalClaims {
  expiresAt: number;
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new Error('SUPABASE_JWT_SECRET is not set');
  }
  return new TextEncoder().encode(secret);
}

function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  }
  return url;
}

function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
  }
  return key;
}

function getIssuer(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? PORTAL_JWT_ISSUER_DEFAULT;
}

/**
 * Sign a portal JWT carrying the claims RLS will check.
 * TTL is enforced both inside the JWT (exp claim) and at the cookie layer.
 *
 * The corresponding portal_tokens row must have been stamped `used_at` BEFORE
 * this JWT is minted — the RLS policy on `clients` requires `used_at IS NOT NULL`
 * (a token that was never redeemed cannot seed a portal session).
 */
export async function signPortalJwt(
  claims: PortalClaims,
  ttlSeconds: number,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    role: 'portal',
    client_id: claims.clientId,
    workspace_id: claims.workspaceId,
    portal_token_id: claims.portalTokenId,
  })
    .setProtectedHeader({ alg: PORTAL_JWT_ALG })
    .setIssuedAt(now)
    .setIssuer(getIssuer())
    .setAudience(PORTAL_JWT_AUDIENCE)
    .setExpirationTime(now + ttlSeconds)
    .sign(getJwtSecret());
}

/**
 * Verify a portal JWT. Returns the decoded claims on success, or null on any
 * verification failure (expired, tampered, wrong audience, wrong issuer, etc.).
 *
 * Null-on-failure prevents information leakage — the caller cannot distinguish
 * "token from another system" from "expired token" from "garbage string".
 */
export async function verifyPortalJwt(
  jwt: string,
): Promise<PortalSession | null> {
  try {
    const { payload } = await jwtVerify(jwt, getJwtSecret(), {
      algorithms: [PORTAL_JWT_ALG],
      audience: PORTAL_JWT_AUDIENCE,
      issuer: getIssuer(),
    });

    const clientId = payload.client_id;
    const workspaceId = payload.workspace_id;
    const portalTokenId = payload.portal_token_id;
    const exp = payload.exp;

    if (
      typeof clientId !== 'string' ||
      typeof workspaceId !== 'string' ||
      typeof portalTokenId !== 'string' ||
      typeof exp !== 'number'
    ) {
      return null;
    }

    return {
      clientId,
      workspaceId,
      portalTokenId,
      expiresAt: exp,
    };
  } catch (err) {
    if (
      err instanceof joseErrors.JWTExpired ||
      err instanceof joseErrors.JWTClaimValidationFailed ||
      err instanceof joseErrors.JWSSignatureVerificationFailed ||
      err instanceof joseErrors.JWSInvalid ||
      err instanceof joseErrors.JWTInvalid
    ) {
      return null;
    }
    // Unknown error — fail closed (treat as invalid token).
    return null;
  }
}

interface CookieItem {
  name: string;
  value: string;
  options?: Record<string, unknown>;
}

interface ReadonlyCookieStore {
  getAll: () => CookieItem[];
  set: (name: string, value: string, options?: Record<string, unknown>) => void;
}

function createReadonlyCookieStore(): ReadonlyCookieStore {
  return {
    getAll: () => [],
    set: () => {
      // Portal SSR client is server-only and does not persist Supabase auth cookies.
    },
  };
}

/**
 * Create a Supabase SSR client scoped to a portal session. The portal JWT is set
 * as a bearer token in the Authorization header. Postgres sees the claims via
 * `request.jwt.claims` and applies the `portal` role RLS policies.
 *
 * The client has no Supabase Auth session — `auth.getUser()` will return null.
 * Use this client ONLY for reads of portal-facing tables (clients, invoices,
 * reports once 9-2 adds the policies). Never for mutations.
 *
 * Uses `@supabase/ssr` (project-context.md: no direct @supabase/supabase-js
 * in portal code). The SSR cookie store is intentionally read-only because
 * the portal session is managed through the `__flow_portal` cookie, not
 * Supabase Auth cookies.
 */
export async function createPortalClient(
  claims: PortalClaims,
  ttlSeconds: number,
): Promise<SupabaseClient> {
  const jwt = await signPortalJwt(claims, ttlSeconds);
  const cookieStore = createReadonlyCookieStore();

  return createSsrServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => {
        for (const { name, value, options } of items) {
          cookieStore.set(name, value, options);
        }
      },
    },
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}
