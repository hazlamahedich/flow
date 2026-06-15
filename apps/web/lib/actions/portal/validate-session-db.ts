/**
 * DB-backed portal session validation.
 *
 * Verifies the `__flow_portal` cookie JWT AND confirms the underlying
 * `portal_tokens` row is still valid (not revoked, not expired, used). This
 * closes the revocation gap: a revoked or expired token stops the portal
 * session immediately, not when the JWT itself expires.
 *
 * Story 9.1a — AC2, AC4, FR54.
 */
'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { validatePortalSession } from './portal-session';
import type { PortalContext } from './helpers';

/**
 * Validate the portal session cookie and confirm the backing token is still
 * valid in the database. Returns the session context or null.
 */
export async function validatePortalSessionWithDb(): Promise<PortalContext | null> {
  const context = await validatePortalSession();
  if (!context) {
    return null;
  }

  const supabase = await getServerSupabase();

  const { data, error } = await supabase
    .from('portal_tokens')
    .select('id')
    .eq('id', context.portalTokenId)
    .eq('client_id', context.clientId)
    .eq('workspace_id', context.workspaceId)
    .gt('expires_at', new Date().toISOString())
    .is('revoked_at', null)
    .not('used_at', 'is', null)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return context;
}
