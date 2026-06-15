/**
 * Story 9.1b Acceptance Tests — Portal Branding & Theming (RED PHASE)
 * Tests light theme palette, branding presets, constrained customization vars,
 * resolver merge semantics, and provider rendering.
 *
 * Imports are from real modules that do not yet exist. This spec is intentionally
 * RED until the implementation is written in the GREEN phase.
 *
 * FR51, UX-DR3, UX-DR4, UX-DR35
 */
import { describe, test, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import {
  PORTAL_LIGHT_THEME,
  MAX_VISUAL_VARS,
  MAX_CONTENT_VARS,
  VISUAL_VAR_KEYS,
  CONTENT_VAR_KEYS,
} from '@/lib/portal-branding/constants';
import { PORTAL_BRANDING_PRESETS } from '@/lib/portal-branding/presets';
import { brandingConfigSchema } from '@/lib/portal-branding/schema';
import {
  resolveBrandingPreset,
  type PortalBrandingConfig,
} from '@/lib/portal-branding/resolve';
import { PortalBrandingStyle } from '@/app/portal/components/PortalBrandingStyle';
import {
  PortalBrandingProvider,
  usePortalBranding,
} from '@/app/portal/components/PortalBrandingProvider';

afterEach(() => {
  cleanup();
});

// ───────────────────────────────────────────────────────────────
// ATDD-001: Light theme palette per UX-DR3 + trophy-case UX-DR35
// ───────────────────────────────────────────────────────────────
describe('[P0] [9.1b-ATDD-001] portal uses warm light theme per UX-DR3', () => {
  test('surface color is warm cream #FAFAF8', () => {
    expect(PORTAL_LIGHT_THEME.surface).toBe('#FAFAF8');
  });

  test('accent color is warm gold #D4A574', () => {
    expect(PORTAL_LIGHT_THEME.accent).toBe('#D4A574');
  });

  test('borders use warm gray, not slate', () => {
    expect(PORTAL_LIGHT_THEME.border).toBeDefined();
    expect(PORTAL_LIGHT_THEME.border).not.toBe('#E5E7EB');
  });

  test('theme conveys trophy-case premium feel, not clinical (UX-DR35)', () => {
    expect(PORTAL_LIGHT_THEME.surface).toMatch(/^#FA/);
    expect(PORTAL_LIGHT_THEME.surface).not.toBe('#FFFFFF');
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-002: Branding presets (UX-DR4)
// ───────────────────────────────────────────────────────────────
describe('[P0] [9.1b-ATDD-002] curated branding presets available (UX-DR4)', () => {
  test('Minimalist preset exists', () => {
    expect(PORTAL_BRANDING_PRESETS).toHaveProperty('minimalist');
  });

  test('Warm Host preset exists', () => {
    expect(PORTAL_BRANDING_PRESETS).toHaveProperty('warm-host');
  });

  test('Bold Professional preset exists', () => {
    expect(PORTAL_BRANDING_PRESETS).toHaveProperty('bold-professional');
  });

  test('each preset defines exactly the 8 visual variables', () => {
    for (const [, preset] of Object.entries(PORTAL_BRANDING_PRESETS)) {
      expect(Object.keys(preset.visual)).toHaveLength(8);
      expect(Object.keys(preset.visual).sort()).toEqual(
        [...VISUAL_VAR_KEYS].sort()
      );
    }
  });

  test('each preset defines exactly the 4 content variables', () => {
    for (const [, preset] of Object.entries(PORTAL_BRANDING_PRESETS)) {
      expect(Object.keys(preset.content)).toHaveLength(4);
      expect(Object.keys(preset.content).sort()).toEqual(
        [...CONTENT_VAR_KEYS].sort()
      );
    }
  });

  test('warm-host preset uses Playfair Display heading', () => {
    expect(PORTAL_BRANDING_PRESETS['warm-host'].visual.fontHeading).toBe(
      'Playfair Display'
    );
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-003: Constrained customization caps (UX-DR4)
// ───────────────────────────────────────────────────────────────
describe('[P0] [9.1b-ATDD-003] customization constrained to 8 visual + 4 content vars max', () => {
  test('MAX_VISUAL_VARS is 8', () => {
    expect(MAX_VISUAL_VARS).toBe(8);
  });

  test('MAX_CONTENT_VARS is 4', () => {
    expect(MAX_CONTENT_VARS).toBe(4);
  });

  test('brandingConfigSchema rejects >8 visual vars', () => {
    const tooMany: PortalBrandingConfig = {
      preset: 'minimalist',
      visual: Object.fromEntries(
        Array.from({ length: 9 }, (_, i) => [`v${i}`, '#000000'])
      ),
    };
    expect(brandingConfigSchema.safeParse(tooMany).success).toBe(false);
  });

  test('brandingConfigSchema rejects >4 content vars', () => {
    const tooMany: PortalBrandingConfig = {
      preset: 'minimalist',
      content: Object.fromEntries(
        Array.from({ length: 5 }, (_, i) => [`c${i}`, 'x'])
      ),
    };
    expect(brandingConfigSchema.safeParse(tooMany).success).toBe(false);
  });

  test('brandingConfigSchema accepts exactly 8 visual + 4 content vars (boundary)', () => {
    const ok: PortalBrandingConfig = {
      preset: 'warm-host',
      visual: {
        accent: '#D4A574',
        surface: '#FAFAF8',
        fontHeading: 'Inter',
        fontBody: 'Inter',
        radius: '4px',
        spacing: '16px',
        border: '#E8E0D8',
        logoShape: 'circle',
      },
      content: {
        greeting: 'Hello',
        tagline: 'Tagline',
        cta: 'Go',
        footer: 'Bye',
      },
    };
    expect(brandingConfigSchema.safeParse(ok).success).toBe(true);
  });

  test('brandingConfigSchema accepts 0 visual / 0 content (empty optional objects)', () => {
    const empty: PortalBrandingConfig = { preset: 'minimalist' };
    expect(brandingConfigSchema.safeParse(empty).success).toBe(true);
  });

  test('brandingConfigSchema rejects 7 visual + 1 disallowed key', () => {
    const bad: PortalBrandingConfig = {
      preset: 'minimalist',
      visual: {
        accent: '#D4A574',
        surface: '#FAFAF8',
        fontHeading: 'Inter',
        fontBody: 'Inter',
        radius: '4px',
        spacing: '16px',
        border: '#E8E0D8',
        logoShape: 'circle',
        extraKey: '#000000',
      },
    };
    expect(brandingConfigSchema.safeParse(bad).success).toBe(false);
  });

  test('brandingConfigSchema rejects non-hex color override', () => {
    const bad: PortalBrandingConfig = {
      preset: 'minimalist',
      visual: { accent: 'red' },
    };
    expect(brandingConfigSchema.safeParse(bad).success).toBe(false);
  });

  test('brandingConfigSchema rejects unknown font override', () => {
    const bad: PortalBrandingConfig = {
      preset: 'minimalist',
      visual: { fontHeading: 'Papyrus' },
    };
    expect(brandingConfigSchema.safeParse(bad).success).toBe(false);
  });

  test('brandingConfigSchema rejects oversized content string', () => {
    const bad: PortalBrandingConfig = {
      preset: 'minimalist',
      content: { greeting: 'x'.repeat(501) },
    };
    expect(brandingConfigSchema.safeParse(bad).success).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-004: Preset resolution
// ───────────────────────────────────────────────────────────────
describe('[P1] [9.1b-ATDD-004] resolveBrandingPreset merges preset with overrides', () => {
  test('resolveBrandingPreset returns all preset defaults with no overrides', () => {
    const resolved = resolveBrandingPreset('minimalist', {});
    expect(Object.keys(resolved.visual).sort()).toEqual([...VISUAL_VAR_KEYS].sort());
    expect(Object.keys(resolved.content).sort()).toEqual([...CONTENT_VAR_KEYS].sort());
    expect(resolved.visual.accent).toBe(PORTAL_BRANDING_PRESETS.minimalist.visual.accent);
  });

  test('resolveBrandingPreset applies visual overrides over preset', () => {
    const overridden = resolveBrandingPreset('bold-professional', {
      visual: { accent: '#FF0000' },
    });
    expect(overridden.visual.accent).toBe('#FF0000');
    expect(overridden.visual.surface).toBe(
      PORTAL_BRANDING_PRESETS['bold-professional'].visual.surface
    );
  });

  test('resolveBrandingPreset applies content overrides over preset', () => {
    const overridden = resolveBrandingPreset('warm-host', {
      content: { greeting: 'Welcome' },
    });
    expect(overridden.content.greeting).toBe('Welcome');
    expect(overridden.content.tagline).toBe(
      PORTAL_BRANDING_PRESETS['warm-host'].content.tagline
    );
  });

  test('resolveBrandingPreset defaults to warm-host when preset is omitted', () => {
    const resolved = resolveBrandingPreset(undefined, {});
    expect(resolved.visual.surface).toBe(PORTAL_LIGHT_THEME.surface);
    expect(resolved.visual.accent).toBe(PORTAL_LIGHT_THEME.accent);
  });

  test('resolveBrandingPreset falls back to minimalist for unknown preset, merging overrides', () => {
    const resolved = resolveBrandingPreset('nonexistent', {
      visual: { accent: '#111111' },
      content: { greeting: 'Hi' },
    });
    expect(resolved.visual.accent).toBe('#111111');
    expect(resolved.visual.surface).toBe(PORTAL_BRANDING_PRESETS.minimalist.visual.surface);
    expect(resolved.content.greeting).toBe('Hi');
    expect(Object.keys(resolved.content)).toHaveLength(4);
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-005: Server Component style injection
// ───────────────────────────────────────────────────────────────
describe('[P0] [9.1b-ATDD-005] PortalBrandingStyle injects scoped CSS vars', () => {
  test('renders a style block with portal-scoped CSS variables', () => {
    const { container } = render(
      <PortalBrandingStyle config={{ preset: 'warm-host' }}>
        <div data-testid="child">child</div>
      </PortalBrandingStyle>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(container.querySelector('[data-portal-branding]')).toBeInTheDocument();

    const style = container.querySelector('style');
    expect(style).toBeInTheDocument();
    expect(style?.textContent).toContain('--portal-accent');
    expect(style?.textContent).toContain('--portal-surface');
    expect(style?.textContent).toContain('--portal-border');
  });

  test('does not mutate global --flow-* variables in the style block', () => {
    const { container } = render(
      <PortalBrandingStyle config={{ preset: 'warm-host' }}>
        <div />
      </PortalBrandingStyle>
    );
    const style = container.querySelector('style');
    expect(style?.textContent).not.toContain('--flow-bg-canvas');
    expect(style?.textContent).not.toContain('--flow-text-primary');
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-006: Client Component content context
// ───────────────────────────────────────────────────────────────
function ContentConsumer() {
  const branding = usePortalBranding();
  return (
    <div data-testid="content">
      {branding.content.greeting}
      {branding.content.tagline}
      {branding.content.cta}
      {branding.content.footer}
    </div>
  );
}

describe('[P1] [9.1b-ATDD-006] PortalBrandingProvider exposes content vars via Context', () => {
  test('content defaults are reachable via usePortalBranding', () => {
    render(
      <PortalBrandingProvider config={{ preset: 'warm-host' }}>
        <ContentConsumer />
      </PortalBrandingProvider>
    );

    const el = screen.getByTestId('content');
    expect(el.textContent).toContain(
      PORTAL_BRANDING_PRESETS['warm-host'].content.greeting
    );
    expect(el.textContent).toContain(
      PORTAL_BRANDING_PRESETS['warm-host'].content.tagline
    );
  });

  test('content overrides are reflected in context', () => {
    render(
      <PortalBrandingProvider
        config={{ preset: 'minimalist', content: { greeting: 'Hey' } }}
      >
        <ContentConsumer />
      </PortalBrandingProvider>
    );

    expect(screen.getByTestId('content').textContent).toContain('Hey');
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-007: 9-1a layout CSS variable reconciliation
//
// Covered by the 9-1a layout unit tests after T3.2 fixes the variable names.
// This ATDD stays focused on 9-1b branding contracts; the layout wiring is
// asserted indirectly through the provider/layer integration in ATDD-005.
// ───────────────────────────────────────────────────────────────
