import { redirect } from 'next/navigation';
import { validatePortalTokenAction } from '@/lib/actions/portal/validate-token';
import {
  getPortalPath,
  getFallbackPortalPath,
} from '@/lib/actions/portal/portal-session';
import { sanitizeSlug } from '@/lib/actions/portal/helpers';
import { getServerSupabase } from '@/lib/supabase-server';

/**
 * Magic-link redemption route.
 *
 * URL: `/portal/redeem?token=<token>&slug=<slug>`
 *
 * This route is intentionally OUTSIDE the `(portal)` route group (which would
 * require a valid session cookie). It:
 *   1. Reads the opaque token from the query string.
 *   2. Calls `validatePortalTokenAction` which:
 *      - Looks up the token via the SECURITY DEFINER `verify_portal_token` RPC
 *        (atomic single-use consumption — sets `used_at`).
 *      - Issues the 24h `__flow_portal` HttpOnly cookie.
 *   3. Redirects to `/portal/{slug}/overview` on success.
 *   4. Redirects to `/portal/{slug}` on failure (the layout renders an
 *      "expired link" message — no enumeration detail).
 *
 * FR51: clients never see a Flow OS login. FR8: failures look identical to
 * the layout's "session expired" view (no enumeration).
 */
export default async function RedeemPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; slug?: string }>;
}) {
  const { token, slug } = await searchParams;
  const safeSlug = sanitizeSlug(slug);
  const fallbackPath = getFallbackPortalPath();

  if (!token || !safeSlug) {
    redirect(
      safeSlug ? (getPortalPath(safeSlug) ?? fallbackPath) : fallbackPath,
    );
  }

  const context = await validatePortalTokenAction(token);

  if (!context) {
    redirect(getPortalPath(safeSlug) ?? fallbackPath);
  }

  // Resolve the canonical workspace slug. If the URL slug doesn't match
  // (link shared between clients), redirect to the canonical workspace slug.
  let canonicalSlug = safeSlug;
  try {
    const supabase = await getServerSupabase();
    const { data } = await supabase
      .from('workspaces')
      .select('slug')
      .eq('id', context.workspaceId)
      .maybeSingle();
    const ws = data as { slug?: string } | null;
    if (ws?.slug && sanitizeSlug(ws.slug)) {
      canonicalSlug = ws.slug;
    }
  } catch {
    // Keep URL slug on lookup failure (best-effort).
  }

  redirect(`${getPortalPath(canonicalSlug) ?? fallbackPath}/overview`);
}
