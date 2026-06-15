/**
 * PortalBrandingStyle — Server Component that injects scoped CSS custom
 * properties via a runtime `<style>` block.
 *
 * Story 9.1b — AC5, T2.1.
 *
 * architecture.md:465 mandates runtime `<style>` injection, NOT CSS file swap.
 * The style block is scoped to `[data-portal-branding]` and maps the 8 visual
 * variables to CSS custom properties. Global `--flow-*` vars are never mutated.
 */
import { type ReactNode } from 'react';
import { resolveBrandingPreset, type PortalBrandingConfig } from '@/lib/portal-branding/resolve';
import type { ResolvedBranding } from '@/lib/portal-branding/resolve';
import { resolveFontStack } from '../font-stacks';

/** CSS var names for the 8 visual variables (portal-scoped). */
const VISUAL_CSS_VARS: ReadonlyArray<[string, keyof ResolvedBranding['visual']]> = [
  ['--portal-accent', 'accent'],
  ['--portal-surface', 'surface'],
  ['--portal-border', 'border'],
  ['--portal-radius', 'radius'],
  ['--portal-spacing', 'spacing'],
  ['--portal-logo-shape', 'logoShape'],
];

/** Build the scoped CSS text from resolved branding. */
function buildCssText(resolved: ResolvedBranding): string {
  const entries: string[] = [];

  for (const [cssVar, visualKey] of VISUAL_CSS_VARS) {
    const value = resolved.visual[visualKey];
    if (value) {
      entries.push(`  ${cssVar}: ${value};`);
    }
  }

  // Font vars need font-family stacks, not raw names.
  const headingStack = resolveFontStack(resolved.visual.fontHeading);
  const bodyStack = resolveFontStack(resolved.visual.fontBody);
  entries.push(`  --portal-font-heading: ${headingStack};`);
  entries.push(`  --portal-font-body: ${bodyStack};`);

  return `[data-portal-branding] {\n${entries.join('\n')}\n}`;
}

interface PortalBrandingStyleProps {
  config?: PortalBrandingConfig | undefined;
  children: ReactNode;
}

/**
 * Server Component — resolves branding config and injects CSS custom properties
 * scoped under `[data-portal-branding]`. Defaults to `warm-host` when no config.
 */
export function PortalBrandingStyle({ config, children }: PortalBrandingStyleProps) {
  const resolved = resolveBrandingPreset(config?.preset, {
    ...(config?.visual && { visual: config.visual }),
    ...(config?.content && { content: config.content }),
  });

  const cssText = buildCssText(resolved);

  return (
    <div data-portal-branding>
      <style dangerouslySetInnerHTML={{ __html: cssText }} />
      {children}
    </div>
  );
}

export type { PortalBrandingStyleProps };
