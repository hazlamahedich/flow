/**
 * PortalBrandingProvider — Client Component providing resolved content vars
 * via React Context.
 *
 * Story 9.1b — AC5, T2.2.
 *
 * Server Component children receive content defaults as props where possible;
 * interactive Client Components consume them via `usePortalBranding`.
 */
'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { resolveBrandingPreset, type PortalBrandingConfig } from '@/lib/portal-branding/resolve';
import type { ResolvedBranding } from '@/lib/portal-branding/resolve';

type PortalBrandingContextValue = ResolvedBranding;

const PortalBrandingContext = createContext<PortalBrandingContextValue | null>(null);

interface PortalBrandingProviderProps {
  config?: PortalBrandingConfig | undefined;
  children: ReactNode;
}

/**
 * Client Component — wraps children and provides resolved content vars
 * via Context. Defaults to `warm-host` when no config is supplied.
 */
export function PortalBrandingProvider({ config, children }: PortalBrandingProviderProps) {
  const resolved = useMemo(
    () =>
      resolveBrandingPreset(config?.preset, {
        ...(config?.visual && { visual: config.visual }),
        ...(config?.content && { content: config.content }),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(config)],
  );

  return (
    <PortalBrandingContext.Provider value={resolved}>
      {children}
    </PortalBrandingContext.Provider>
  );
}

/**
 * Hook to consume portal branding content vars from Context.
 * Throws if used outside of PortalBrandingProvider.
 */
export function usePortalBranding(): PortalBrandingContextValue {
  const ctx = useContext(PortalBrandingContext);
  if (!ctx) {
    throw new Error('usePortalBranding must be used within PortalBrandingProvider');
  }
  return ctx;
}

export { PortalBrandingContext };
