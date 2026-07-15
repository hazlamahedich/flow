import { cookies } from 'next/headers';
import Link from 'next/link';
import { validatePortalSessionWithDb } from '@/lib/actions/portal/actions';
import { PORTAL_COOKIE_NAME } from '@/lib/actions/portal/constants';
import { PortalBrandingStyle } from '@/app/portal/components/PortalBrandingStyle';
import { PortalBrandingProvider } from '@/app/portal/components/PortalBrandingProvider';
import { PORTAL_FONT_CLASSES } from '@/app/portal/fonts';
import { getPortalBranding } from '@/lib/actions/portal-branding/get-branding';
import type { PortalBrandingConfig } from '@/lib/portal-branding/resolve';

/**
 * Portal layout shell.
 *
 * Renders without a Supabase Auth session (FR51). The portal session is carried
 * in the `__flow_portal` HttpOnly cookie (signed JWT, 24h absolute TTL).
 *
 * The slug is the workspace slug — portal URLs are `/portal/{slug}/...`.
 * Magic-link redemption happens at `/portal/redeem` (separate route, no layout)
 * so the cookie isn't required to start a session.
 *
 * UX-DR38: "Powered by Flow OS" footer with referral attribution.
 * UX-DR3/4/35: Portal branding injected via PortalBrandingStyle (scoped CSS
 * custom properties) + PortalBrandingProvider (content vars via Context).
 * Default preset is `warm-host` (warm cream + gold accent, trophy-case feel).
 */
export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Validate the portal session cookie AND backing token DB state. We do NOT
  // redirect to /login — clients have no Flow OS account (FR51). If the
  // session is absent/invalid/revoked, render an inline "link expired" message.
  const session = await validatePortalSessionWithDb();
  const cookieStore = await cookies();
  const hasCookie = cookieStore.get(PORTAL_COOKIE_NAME) !== undefined;

  /**
   * 9-1b T3.2 fix: replaced non-existent --flow-color-* placeholders with
   * canonical --flow-* names from packages/tokens/src/css/generated-themes.css.
   */
  if (!session) {
    return (
      <div className="min-h-screen bg-[var(--flow-bg-canvas)] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-xl font-semibold text-[var(--flow-text-primary)]">
            Your portal link has expired
          </h1>
          <p className="text-sm text-[var(--flow-text-muted)]">
            {hasCookie
              ? 'Your session has ended. Please request a new link from your virtual assistant.'
              : 'This link is invalid, expired, or has already been used. Please request a new link from your virtual assistant.'}
          </p>
        </div>
        <PoweredByFooter slug={slug} />
      </div>
    );
  }

  // 9-1b T3.1: resolve workspace branding config (defaults to warm-host if none).
  const brandingConfig: PortalBrandingConfig | undefined =
    await getPortalBranding(session.workspaceId);

  return (
    <PortalBrandingStyle config={brandingConfig}>
      <PortalBrandingProvider config={brandingConfig}>
        <div
          className={`min-h-screen flex flex-col bg-[var(--flow-bg-canvas)] ${PORTAL_FONT_CLASSES}`}
        >
          <header className="border-b border-[var(--flow-border-default)] px-4 py-2">
            <p className="text-sm text-[var(--flow-text-muted)]">
              Client Portal
            </p>
          </header>
          <main className="flex-1">{children}</main>
          <PoweredByFooter slug={slug} />
        </div>
      </PortalBrandingProvider>
    </PortalBrandingStyle>
  );
}

/**
 * "Powered by Flow OS" footer with referral attribution (UX-DR38).
 * The `?ref=` query param carries the workspace slug so flow.app can attribute
 * portal-driven signups back to the referring VA.
 */
function PoweredByFooter({ slug }: { slug: string }) {
  const refUrl = `https://flow.app/?ref=${encodeURIComponent(slug)}`;
  return (
    <footer className="border-t border-[var(--flow-border-default)] px-4 py-3 text-center">
      <p className="text-xs text-[var(--flow-text-muted)]">
        Powered by{' '}
        <Link
          href={refUrl}
          className="font-medium text-[var(--flow-text-primary)] underline-offset-2 hover:underline"
          rel="noopener noreferrer"
          target="_blank"
        >
          Flow OS
        </Link>
      </p>
    </footer>
  );
}
