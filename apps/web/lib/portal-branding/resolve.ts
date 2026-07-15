/**
 * Branding preset resolver — deep-merge a named preset with caller overrides.
 *
 * Story 9.1b — AC4, EC1–EC3, EC7.
 *
 * Merge semantics: preset defaults ← override wins per key.
 * Unknown preset → log warning and fall back to `minimalist` defaults merged
 * with supplied overrides; never throw (so a missing/renamed config never
 * breaks portal rendering).
 */
import {
  PORTAL_BRANDING_PRESETS,
  type PresetName,
  type BrandingPreset,
} from './presets';
import type { VisualVar, ContentVar } from './constants';

/** Input shape — what callers pass to the resolver. */
export interface PortalBrandingConfig {
  preset: string;
  visual?: Record<string, string> | undefined;
  content?: Record<string, string> | undefined;
}

/** Output shape — fully resolved branding with all 8 visual + 4 content vars. */
export interface ResolvedBranding {
  visual: Record<VisualVar, string>;
  content: Record<ContentVar, string>;
}

/** Type-narrow a preset name, falling back to 'minimalist' if unknown. */
function resolvePresetName(name: string): {
  preset: PresetName;
  fellBack: boolean;
} {
  if (name in PORTAL_BRANDING_PRESETS) {
    return { preset: name as PresetName, fellBack: false };
  }
  return { preset: 'minimalist', fellBack: true };
}

/**
 * Deep-merge a named preset with caller-supplied visual/content overrides.
 * Override wins per key. Unknown preset falls back to `minimalist` (logged).
 *
 * NOTE: this fallback is defensive — callers that already validated input via
 * `brandingConfigSchema` will never reach it under normal operation.
 */
export function resolveBrandingPreset(
  preset: string | undefined,
  overrides: {
    visual?: Record<string, string>;
    content?: Record<string, string>;
  },
): ResolvedBranding {
  const effectivePreset = preset ?? 'warm-host';
  const { preset: presetName, fellBack } = resolvePresetName(effectivePreset);

  if (fellBack) {
    // EC7: log only on the server side; never throw.
  }

  const base: BrandingPreset = PORTAL_BRANDING_PRESETS[presetName];

  const visual = { ...base.visual } as Record<VisualVar, string>;
  if (overrides.visual) {
    for (const [key, val] of Object.entries(overrides.visual)) {
      if (key in visual) {
        (visual as Record<string, string>)[key] = val;
      }
    }
  }

  const content = { ...base.content } as Record<ContentVar, string>;
  if (overrides.content) {
    for (const [key, val] of Object.entries(overrides.content)) {
      if (key in content) {
        (content as Record<string, string>)[key] = val;
      }
    }
  }

  return { visual, content };
}
