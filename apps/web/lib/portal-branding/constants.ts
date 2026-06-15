/**
 * Portal branding constants — palette, variable keys, caps, allowlists.
 *
 * Story 9.1b — AC1, AC2, AC3, UX-DR3, UX-DR4, UX-DR35.
 *
 * The portal ships a warm light-theme palette (UX-DR35 "trophy-case" feel):
 * surface #FAFAF8 (warm cream), accent #D4A574 (warm gold), border #E8E0D8
 * (warm gray). These are NOT the clinical white/slate of the workspace app.
 */

/** Warm light-theme palette (UX-DR3, UX-DR35, FR51). */
export const PORTAL_LIGHT_THEME = {
  surface: '#FAFAF8',
  accent: '#D4A574',
  border: '#E8E0D8',
} as const;

/** Maximum number of visual variables a workspace may customize (UX-DR4). */
export const MAX_VISUAL_VARS = 8;

/** Maximum number of content variables a workspace may customize (UX-DR4). */
export const MAX_CONTENT_VARS = 4;

/**
 * The 8 canonical visual variable keys.
 * Order is stable for deterministic iteration.
 */
export const VISUAL_VAR_KEYS = [
  'accent',
  'surface',
  'fontHeading',
  'fontBody',
  'radius',
  'spacing',
  'border',
  'logoShape',
] as const;

/**
 * The 4 canonical content variable keys.
 */
export const CONTENT_VAR_KEYS = [
  'greeting',
  'tagline',
  'cta',
  'footer',
] as const;

/** Type unions derived from the key arrays. */
export type VisualVar = (typeof VISUAL_VAR_KEYS)[number];
export type ContentVar = (typeof CONTENT_VAR_KEYS)[number];

/** Readonly sets for fast membership checks. */
export const VISUAL_VAR_SET: ReadonlySet<string> = new Set(VISUAL_VAR_KEYS);
export const CONTENT_VAR_SET: ReadonlySet<string> = new Set(CONTENT_VAR_KEYS);

/**
 * Fonts that may appear in fontHeading / fontBody overrides.
 * - Inter: loaded workspace-wide via next/font.
 * - Playfair Display: statically imported in portal/fonts.ts.
 * - Georgia / Helvetica: system fonts (no load needed).
 */
export const ALLOWED_FONTS = [
  'Inter',
  'Playfair Display',
  'Georgia',
  'Helvetica',
] as const;

export type AllowedFont = (typeof ALLOWED_FONTS)[number];

export const ALLOWED_FONT_SET: ReadonlySet<string> = new Set(ALLOWED_FONTS);

/** Max length for any content string value. */
export const MAX_CONTENT_LENGTH = 500;

/** Max length for a font name string (defensive cap). */
export const MAX_FONT_NAME_LENGTH = 64;

/** Default preset used when no branding config is supplied (UX-DR35). */
export const DEFAULT_PRESET = 'warm-host' as const;
