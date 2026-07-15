/**
 * Portal session helpers: issue and validate the `__flow_portal` cookie.
 *
 * Story 9.1a — FR51 (no account required), FR54 (strict isolation).
 */
'use server';

import { cookies } from 'next/headers';
import {
  signPortalJwt,
  verifyPortalJwt,
} from '@flow/auth/server/portal-client';
import { getServerSupabase } from '@/lib/supabase-server';
import {
  PORTAL_COOKIE_NAME,
  PORTAL_SESSION_MAX_AGE_SECONDS,
  PORTAL_SLUG_PLACEHOLDER,
} from './constants';
import { sanitizeSlug } from './helpers';
import type { PortalContext } from './helpers';

/**
 * Issue the 24h `__flow_portal` HttpOnly cookie.
 * AC2 requires HttpOnly, Secure, SameSite=Lax, Path=/ unconditionally.
 */
export async function setPortalSessionCookie(
  context: PortalContext,
): Promise<void> {
  const jwt = await signPortalJwt(context, PORTAL_SESSION_MAX_AGE_SECONDS);
  const cookieStore = await cookies();
  cookieStore.set(PORTAL_COOKIE_NAME, jwt, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: PORTAL_SESSION_MAX_AGE_SECONDS,
  });
}

/**
 * Read the `__flow_portal` cookie and verify the portal session JWT.
 * Returns the claims if the session is valid, or null otherwise.
 *
 * Called by the portal layout on every portal page render to gate access.
 * Pure JWT read — DB validity check happens in `validatePortalSessionWithDb`.
 */
export async function validatePortalSession(): Promise<PortalContext | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(PORTAL_COOKIE_NAME);
  if (!cookie) {
    return null;
  }

  const claims = await verifyPortalJwt(cookie.value);
  if (!claims) {
    return null;
  }

  return {
    clientId: claims.clientId,
    workspaceId: claims.workspaceId,
    portalTokenId: claims.portalTokenId,
  };
}

/**
 * Build the canonical portal path prefix for a workspace slug.
 * Returns null if the slug is not safe to use in a URL.
 */
export function getPortalPath(slug: string): string | null {
  const safeSlug = sanitizeSlug(slug);
  if (!safeSlug) {
    return null;
  }
  return `/portal/${safeSlug}`;
}

/** Fallback portal path when no valid slug is available. */
export function getFallbackPortalPath(): string {
  return `/portal/${PORTAL_SLUG_PLACEHOLDER}`;
}

/**
 * Validate the route slug matches the portal session workspace.
 *
 * Portal URLs are `/portal/{workspaceSlug}/...`. After redeeming a magic link,
 * the canonical workspace slug is used. This helper prevents URL spoofing by
 * ensuring the slug in the address bar corresponds to the session workspace.
 */
export async function validatePortalSlug(
  slug: string,
): Promise<PortalContext | null> {
  const session = await validatePortalSession();
  if (!session) {
    return null;
  }

  const safeSlug = sanitizeSlug(slug);
  if (!safeSlug) {
    return null;
  }

  const supabase = await getServerSupabase();
  const { data, error } = await supabase
    .from('workspaces')
    .select('slug')
    .eq('id', session.workspaceId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const ws = data as { slug?: string | null };
  const canonicalSlug = sanitizeSlug(ws.slug ?? '');
  if (canonicalSlug && canonicalSlug !== safeSlug) {
    return null;
  }

  return session;
}
