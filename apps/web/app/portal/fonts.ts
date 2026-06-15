/**
 * Static next/font imports for portal preset fonts.
 *
 * Story 9.1b — T2.4, AC2, EC8.
 *
 * Only Playfair Display needs loading — Inter is already loaded workspace-wide,
 * and Georgia / Helvetica are system fonts. Self-hosted by next/font; no CDN.
 *
 * NOTE: This module is NOT imported by PortalBrandingStyle (which uses the pure
 * resolveFontStack from font-stacks.ts). It is imported only by the portal
 * layout to apply the next/font CSS variable classes.
 */
import { Playfair_Display, Inter } from 'next/font/google';

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  weight: ['500', '600'],
  display: 'swap',
  variable: '--font-playfair-display',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-inter-portal',
});

/** CSS variable class names to apply on the wrapper for next/font activation. */
export const PORTAL_FONT_CLASSES = [playfairDisplay.variable, inter.variable]
  .filter(Boolean)
  .join(' ');
