/**
 * Zod schema for portal branding configuration.
 *
 * Story 9.1b — AC3, EC4–EC6, EC11.
 *
 * Validates that:
 * - `preset` is a non-empty string.
 * - `visual` (optional) has at most MAX_VISUAL_VARS keys, all from VISUAL_VAR_SET.
 *   Color keys (accent, surface, border) must be 3/6-digit hex.
 *   Font keys (fontHeading, fontBody) must be in ALLOWED_FONTS.
 *   Other visual keys (radius, spacing, logoShape) are free-form strings (capped).
 * - `content` (optional) has at most MAX_CONTENT_VARS keys, all from CONTENT_VAR_SET,
 *   each a string within MAX_CONTENT_LENGTH.
 *
 * Inputs are validated server-side before persistence or rendering.
 */
import { z } from 'zod';
import {
  MAX_VISUAL_VARS,
  MAX_CONTENT_VARS,
  MAX_CONTENT_LENGTH,
  VISUAL_VAR_SET,
  CONTENT_VAR_SET,
  ALLOWED_FONT_SET,
} from './constants';
import { PORTAL_BRANDING_PRESETS } from './presets';

/** Known preset names derived from the curated preset record. */
const PRESET_NAMES = Object.keys(PORTAL_BRANDING_PRESETS) as [
  string,
  ...string[],
];

/** Hex color: 3 or 6 digit, uppercase or lowercase. */
export const hexColorSchema = z
  .string()
  .regex(
    /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/,
    'Must be a valid hex color (e.g. #D4A574)',
  );

/** Font name from the allowlist. */
export const fontNameSchema = z
  .string()
  .refine((v) => ALLOWED_FONT_SET.has(v), 'Font is not in the allowed list');

/** Keys that must be hex colors when present in the visual override. */
const COLOR_VISUAL_KEYS = new Set(['accent', 'surface', 'border']);

/** Keys that must be font names when present in the visual override. */
const FONT_VISUAL_KEYS = new Set(['fontHeading', 'fontBody']);

/**
 * A visual override entry — value validation depends on the key.
 * We use a record schema and then `.refine` to enforce per-key rules.
 *
 * Free-form visual values (radius, spacing, logoShape) are restricted to a
 * conservative allowlist of characters to prevent CSS injection through the
 * runtime `<style>` block. Allowed: letters, numbers, spaces, and the
 * punctuation commonly used in CSS values: `- _ ( ) % px em rem`.
 */
const SAFE_VISUAL_VALUE_PATTERN = /^[a-zA-Z0-9_\-()\s.%]+$/;

const visualOverrideSchema = z
  .record(z.string(), z.string().max(200))
  .refine(
    (rec) => Object.keys(rec).every((k) => VISUAL_VAR_SET.has(k)),
    'Visual override contains an unknown key',
  )
  .refine(
    (rec) => Object.keys(rec).length <= MAX_VISUAL_VARS,
    `Visual overrides may not exceed ${MAX_VISUAL_VARS} keys`,
  )
  .refine(
    (rec) =>
      Object.entries(rec).every(([key, val]) => {
        if (COLOR_VISUAL_KEYS.has(key)) {
          return /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(val);
        }
        return true;
      }),
    'Color keys (accent, surface, border) must be valid hex',
  )
  .refine(
    (rec) =>
      Object.entries(rec).every(([key, val]) => {
        if (FONT_VISUAL_KEYS.has(key)) {
          return ALLOWED_FONT_SET.has(val);
        }
        return true;
      }),
    'Font keys (fontHeading, fontBody) must be from the allowed font list',
  )
  .refine(
    (rec) =>
      Object.entries(rec).every(([key, val]) => {
        if (COLOR_VISUAL_KEYS.has(key) || FONT_VISUAL_KEYS.has(key)) {
          return true;
        }
        return SAFE_VISUAL_VALUE_PATTERN.test(val);
      }),
    'Visual value contains disallowed characters',
  );

/**
 * A content override entry — all values are bounded strings with known keys.
 */
const contentOverrideSchema = z
  .record(z.string(), z.string().max(MAX_CONTENT_LENGTH))
  .refine(
    (rec) => Object.keys(rec).every((k) => CONTENT_VAR_SET.has(k)),
    'Content override contains an unknown key',
  )
  .refine(
    (rec) => Object.keys(rec).length <= MAX_CONTENT_VARS,
    `Content overrides may not exceed ${MAX_CONTENT_VARS} keys`,
  );

/**
 * Full branding configuration schema.
 *
 * The `visual` and `content` fields are optional — a config with just
 * `{ preset: 'warm-host' }` is valid (uses all preset defaults).
 */
export const brandingConfigSchema = z.object({
  preset: z.enum(PRESET_NAMES),
  visual: visualOverrideSchema.optional(),
  content: contentOverrideSchema.optional(),
});
