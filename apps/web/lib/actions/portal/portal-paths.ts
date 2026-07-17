import { sanitizeSlug } from './helpers';

/**
 * Build the canonical portal path prefix for a workspace slug.
 * Returns null if the slug is not safe to use in a URL.
 */
export function getPortalPath(slug: string): string | null {
  const safeSlug = sanitizeSlug(slug);
  if (!safeSlug) {
    return null;
  }
  return `/portal/${safeSlug}`;
}

/** Fallback portal path when no valid slug is available. */
export function getFallbackPortalPath(): string {
  return `/portal/unknown`;
}
