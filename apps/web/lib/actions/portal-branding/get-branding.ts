/**
 * Portal branding read helper — cached DB read for portal layout.
 *
 * Story 9.1b — T4.3, AC6, EC10.
 *
 * Reads `portal_branding` from `workspaces` for a given workspace ID.
 * Wrapped in `unstable_cache` with tag `portal-branding` so that
 * `revalidateTag('portal-branding')` in save-branding.ts invalidates it.
 *
 * Uses the portal-scoped Supabase client (createPortalClient) which carries
 * the portal JWT as a Bearer token — the portal role has a SELECT policy
 * on workspaces.portal_branding (migration 20260616000001).
 *
 * Returns undefined when no branding is configured (layout defaults to warm-host).
 */
import { unstable_cache } from 'next/cache';
import { createPortalClient } from '@flow/auth/server/portal-client';
import { validatePortalSession } from '@/lib/actions/portal/portal-session';
import { brandingConfigSchema } from '@/lib/portal-branding/schema';
import type { PortalBrandingConfig } from '@/lib/portal-branding/resolve';

/** Cache key parts — workspaceId is the cache discriminator. */
const CACHE_TAG = 'portal-branding';
const CACHE_TTL = 3600; // 1 hour

/**
 * Raw DB query — reads portal_branding from workspaces using a portal-scoped
 * Supabase client. The portal JWT is read from the `__flow_portal` cookie.
 */
async function getPortalBrandingQuery(
  workspaceId: string,
): Promise<PortalBrandingConfig | undefined> {
  const session = await validatePortalSession();
  if (!session || session.workspaceId !== workspaceId) {
    return undefined;
  }

  const PORTAL_SESSION_TTL = 24 * 60 * 60;
  const supabase = await createPortalClient(session, PORTAL_SESSION_TTL);

  const { data, error } = await supabase
    .from('workspaces')
    .select('portal_branding')
    .eq('id', workspaceId)
    .maybeSingle();

  if (error || !data) {
    return undefined;
  }

  const raw = data.portal_branding;
  const parsed = brandingConfigSchema.safeParse(raw);
  if (!parsed.success) {
    // Defensive: corrupted/legacy rows fall back to defaults.
    return undefined;
  }

  return parsed.data;
}

/**
 * Cached read helper. Returns the workspace's portal branding config or
 * undefined (layout defaults to warm-host preset).
 *
 * EC10: when branding is changed by the VA, `revalidateTag('portal-branding')`
 * invalidates this cache so the next render picks up new values.
 */
export const getPortalBranding = unstable_cache(
  getPortalBrandingQuery,
  ['portal-branding'],
  {
    tags: [CACHE_TAG],
    revalidate: CACHE_TTL,
  },
);
