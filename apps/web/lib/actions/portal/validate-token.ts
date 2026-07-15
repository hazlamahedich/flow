/**
 * Portal-side Server Action: validate a magic-link token and issue a session.
 *
 * Story 9.1a — AC2, FR8, FR51.
 */
'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { PORTAL_TOKEN_RATE_LIMIT_PER_HOUR } from './constants';
import { validateTokenFormat, isRateLimited, getIpIdentifier } from './helpers';
import { setPortalSessionCookie } from './portal-session';
import type { PortalContext } from './helpers';

/**
 * Validate a magic-link token and establish a portal session.
 *
 * Called by the `/portal/redeem` page when a client clicks a magic link. Uses
 * the SECURITY DEFINER `verify_portal_token` RPC as anon (clients have no
 * Supabase Auth session). On success, atomically stamps `used_at` (single-use)
 * and sets the `__flow_portal` cookie (24h absolute TTL).
 *
 * Returns null for expired, revoked, already-used, or unknown tokens — callers
 * cannot distinguish failure modes (no enumeration, FR8).
 */
export async function validatePortalTokenAction(
  token: string,
): Promise<PortalContext | null> {
  const validToken = validateTokenFormat(token);
  if (!validToken) {
    return null;
  }

  const supabase = await getServerSupabase();

  if (await isValidationRateLimited(supabase)) {
    return null;
  }

  const context = await consumePortalToken(supabase, validToken);
  if (!context) {
    return null;
  }

  await setPortalSessionCookie(context);

  return context;
}

async function isValidationRateLimited(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
): Promise<boolean> {
  const ipIdentifier = await getIpIdentifier();
  const { data: rlResult } = await supabase.rpc('check_rate_limit', {
    p_identifier: ipIdentifier,
    p_action: 'portal_token_validate',
    p_max_requests: PORTAL_TOKEN_RATE_LIMIT_PER_HOUR,
    p_window_seconds: 60 * 60,
    p_min_interval_seconds: 0,
  });

  return isRateLimited(rlResult).limited;
}

async function consumePortalToken(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  token: string,
): Promise<PortalContext | null> {
  const { data, error } = await supabase.rpc('verify_portal_token', {
    p_token: token,
  });

  if (error || !data) {
    return null;
  }

  const rows = data as Array<{
    client_id: string;
    workspace_id: string;
    token_id: string;
  }>;

  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    clientId: row.client_id,
    workspaceId: row.workspace_id,
    portalTokenId: row.token_id,
  };
}
