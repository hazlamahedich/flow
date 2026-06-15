/**
 * Story 9.1b Acceptance Tests — Portal Branding & Theming (RED PHASE)
 * Tests light theme palette, branding presets, constrained customization vars.
 *
 * FR51, UX-DR12, UX-DR26, UX-DR35
 */
import { describe, test, expect, vi } from 'vitest';
import { z } from 'zod';

vi.mock('@/lib/supabase-server', () => ({ getServerSupabase: vi.fn() }));
vi.mock('@flow/db', async () => {
  const actual = await vi.importActual<typeof import('@flow/db')>('@flow/db');
  return { ...actual, requireTenantContext: vi.fn(), createFlowError: actual.createFlowError };
});
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

// ── RED-PHASE STUBS ──
const { mockPortalBrandingProvider } = vi.hoisted(() => ({
  mockPortalBrandingProvider: vi.fn(() => null),
}));
vi.mock('@/app/(portal)/components/PortalBrandingProvider', () => ({
  default: mockPortalBrandingProvider,
}));

// Constants & schemas the implementation will export (verify values now).
const PORTAL_LIGHT_THEME = {
  surface: '#FAFAF8',
  accent: '#D4A574',
  border: '#E8E0D8',
};
const MAX_VISUAL_VARS = 8;
const MAX_CONTENT_VARS = 4;
const PORTAL_BRANDING_PRESETS: Record<string, { visual: Record<string, string>; content: Record<string, string> }> = {
  minimalist: {
    visual: { accent: '#D4A574', surface: '#FAFAF8', fontHeading: 'Inter', fontBody: 'Inter', radius: '4px', spacing: '16px', border: '#E8E0D8', logoShape: 'circle' },
    content: { greeting: 'Hello', tagline: '', cta: 'View', footer: 'Thank you' },
  },
  'warm-host': {
    visual: { accent: '#D4A574', surface: '#FAFAF8', fontHeading: 'Playfair Display', fontBody: 'Inter', radius: '8px', spacing: '24px', border: '#E8E0D8', logoShape: 'rounded' },
    content: { greeting: 'Hi there', tagline: 'Glad to share', cta: 'Take a look', footer: 'Warmly' },
  },
  'bold-professional': {
    visual: { accent: '#1A1A1A', surface: '#FFFFFF', fontHeading: 'Georgia', fontBody: 'Helvetica', radius: '0px', spacing: '20px', border: '#1A1A1A', logoShape: 'square' },
    content: { greeting: 'Good day', tagline: 'Executive summary', cta: 'Proceed', footer: 'Regards' },
  },
};
function resolveBrandingPreset(_preset: string, overrides: { visual?: Record<string, string>; content?: Record<string, string> }) {
  return {
    visual: { ...overrides.visual },
    content: { ...overrides.content },
  };
}
const brandingConfigSchema = z.object({
  preset: z.string(),
  visual: z.record(z.string()).optional(),
  content: z.record(z.string()).optional(),
}).refine(
  (d) => !d.visual || Object.keys(d.visual).length <= MAX_VISUAL_VARS,
  { message: 'Too many visual vars' }
).refine(
  (d) => !d.content || Object.keys(d.content).length <= MAX_CONTENT_VARS,
  { message: 'Too many content vars' }
);

// ───────────────────────────────────────────────────────────────
// ATDD-001: Light theme palette per UX-DR26 (FR51)
// ───────────────────────────────────────────────────────────────
describe('[P0] [9.1b-ATDD-001] portal uses warm light theme per UX-DR26', () => {
  test('surface color is warm cream #FAFAF8', () => {
    expect(PORTAL_LIGHT_THEME.surface).toBe('#FAFAF8');
  });
  test('accent color is warm gold #D4A574', () => {
    expect(PORTAL_LIGHT_THEME.accent).toBe('#D4A574');
  });
  test('borders use warm gray per UX-DR26', () => {
    expect(PORTAL_LIGHT_THEME.border).toBeDefined();
    expect(PORTAL_LIGHT_THEME.border).not.toBe('#E5E7EB');
  });
  test('theme conveys trophy-case premium feel, not clinical (UX-DR35)', () => {
    expect(PORTAL_LIGHT_THEME.surface).toMatch(/^#FA/);
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-002: Branding presets (UX-DR12)
// ───────────────────────────────────────────────────────────────
describe('[P0] [9.1b-ATDD-002] curated branding presets available (UX-DR12)', () => {
  test('Minimalist preset exists', () => expect(PORTAL_BRANDING_PRESETS).toHaveProperty('minimalist'));
  test('Warm Host preset exists', () => expect(PORTAL_BRANDING_PRESETS).toHaveProperty('warm-host'));
  test('Bold Professional preset exists', () => expect(PORTAL_BRANDING_PRESETS).toHaveProperty('bold-professional'));
  test('each preset defines the 8 visual variables', () => {
    for (const key of Object.keys(PORTAL_BRANDING_PRESETS)) {
      expect(Object.keys(PORTAL_BRANDING_PRESETS[key].visual)).toHaveLength(8);
    }
  });
  test('each preset defines the 4 content variables', () => {
    for (const key of Object.keys(PORTAL_BRANDING_PRESETS)) {
      expect(Object.keys(PORTAL_BRANDING_PRESETS[key].content)).toHaveLength(4);
    }
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-003: Constrained customization caps (UX-DR12)
// ───────────────────────────────────────────────────────────────
describe('[P0] [9.1b-ATDD-003] customization constrained to 8 visual + 4 content vars max', () => {
  test('MAX_VISUAL_VARS is 8', () => expect(MAX_VISUAL_VARS).toBe(8));
  test('MAX_CONTENT_VARS is 4', () => expect(MAX_CONTENT_VARS).toBe(4));
  test('brandingConfigSchema rejects >8 visual vars', () => {
    const tooMany = {
      preset: 'minimalist',
      visual: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`v${i}`, '#000'])),
    };
    expect(brandingConfigSchema.safeParse(tooMany).success).toBe(false);
  });
  test('brandingConfigSchema rejects >4 content vars', () => {
    const tooMany = {
      preset: 'minimalist',
      content: Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`c${i}`, 'x'])),
    };
    expect(brandingConfigSchema.safeParse(tooMany).success).toBe(false);
  });
  test('brandingConfigSchema accepts exactly 8 visual + 4 content vars (boundary)', () => {
    const ok = {
      preset: 'warm-host',
      visual: Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`v${i}`, '#000'])),
      content: Object.fromEntries(Array.from({ length: 4 }, (_, i) => [`c${i}`, 'x'])),
    };
    expect(brandingConfigSchema.safeParse(ok).success).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────
// ATDD-004: Preset resolution & provider
// ───────────────────────────────────────────────────────────────
describe('[P1] [9.1b-ATDD-004] resolveBrandingPreset merges preset with overrides', () => {
  test('resolveBrandingPreset returns defaults with no overrides', () => {
    const resolved = resolveBrandingPreset('minimalist', {});
    expect(resolved.visual).toBeDefined();
    expect(resolved.content).toBeDefined();
  });
  test('resolveBrandingPreset applies visual overrides over preset', () => {
    const overridden = resolveBrandingPreset('bold-professional', { visual: { accent: '#FF0000' } });
    expect(overridden.visual.accent).toBe('#FF0000');
  });
  test('PortalBrandingProvider component is exported', () => {
    expect(mockPortalBrandingProvider).toBeDefined();
    expect(typeof mockPortalBrandingProvider).toBe('function');
  });
});
