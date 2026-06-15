/**
 * Portal branding barrel — package-boundary export.
 *
 * Story 9.1b — T1.5.
 */
export {
  PORTAL_LIGHT_THEME,
  MAX_VISUAL_VARS,
  MAX_CONTENT_VARS,
  VISUAL_VAR_KEYS,
  CONTENT_VAR_KEYS,
  VISUAL_VAR_SET,
  CONTENT_VAR_SET,
  ALLOWED_FONTS,
  ALLOWED_FONT_SET,
  MAX_CONTENT_LENGTH,
  MAX_FONT_NAME_LENGTH,
  DEFAULT_PRESET,
} from './constants';
export type { VisualVar, ContentVar, AllowedFont } from './constants';

export {
  PORTAL_BRANDING_PRESETS,
} from './presets';
export type { PresetName, BrandingPreset } from './presets';

export {
  hexColorSchema,
  fontNameSchema,
  brandingConfigSchema,
} from './schema';

export {
  resolveBrandingPreset,
} from './resolve';
export type { PortalBrandingConfig, ResolvedBranding } from './resolve';
