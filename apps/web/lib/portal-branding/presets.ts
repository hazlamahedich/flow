/**
 * Curated portal branding presets (UX-DR4).
 *
 * Story 9.1b — AC2.
 *
 * Three presets, each defining exactly 8 visual + 4 content variables:
 * - minimalist: clean, Inter throughout, tight spacing, neutral warmth.
 * - warm-host: the default — Playfair Display headings, warm gold accent,
 *   generous spacing, rounded corners. Delivers the trophy-case feel (UX-DR35).
 * - bold-professional: clinical-adjacent — white surface, square corners,
 *   Georgia headings. An opt-in preset, not the default.
 */
import { PORTAL_LIGHT_THEME } from './constants';
import type { VisualVar, ContentVar } from './constants';

export type PresetName = 'minimalist' | 'warm-host' | 'bold-professional';

export interface BrandingPreset {
  visual: Record<VisualVar, string>;
  content: Record<ContentVar, string>;
}

export const PORTAL_BRANDING_PRESETS: Record<PresetName, BrandingPreset> = {
  minimalist: {
    visual: {
      accent: PORTAL_LIGHT_THEME.accent,
      surface: PORTAL_LIGHT_THEME.surface,
      fontHeading: 'Inter',
      fontBody: 'Inter',
      radius: '4px',
      spacing: '16px',
      border: PORTAL_LIGHT_THEME.border,
      logoShape: 'circle',
    },
    content: {
      greeting: 'Welcome',
      tagline: 'Your client portal',
      cta: 'View details',
      footer: 'Thank you for your partnership.',
    },
  },
  'warm-host': {
    visual: {
      accent: PORTAL_LIGHT_THEME.accent,
      surface: PORTAL_LIGHT_THEME.surface,
      fontHeading: 'Playfair Display',
      fontBody: 'Inter',
      radius: '8px',
      spacing: '24px',
      border: PORTAL_LIGHT_THEME.border,
      logoShape: 'rounded-square',
    },
    content: {
      greeting: 'Welcome to your portal',
      tagline: 'A curated space for your work together',
      cta: 'Explore',
      footer: 'Crafted with care by your virtual assistant.',
    },
  },
  'bold-professional': {
    visual: {
      accent: '#1a1917',
      surface: '#FFFFFF',
      fontHeading: 'Georgia',
      fontBody: 'Helvetica',
      radius: '0px',
      spacing: '20px',
      border: '#D1D5DB',
      logoShape: 'square',
    },
    content: {
      greeting: 'Client Portal',
      tagline: 'Professional collaboration space',
      cta: 'Continue',
      footer: 'All rights reserved.',
    },
  },
};
