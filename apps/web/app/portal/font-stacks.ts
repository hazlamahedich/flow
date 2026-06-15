/**
 * Pure font-stack resolution — no next/font dependency.
 *
 * Maps a preset font name to a CSS font-family stack.
 * System fonts get native stacks; loaded fonts reference CSS variables
 * set by next/font in the layout wrapper.
 */
export function resolveFontStack(fontName: string): string {
  switch (fontName) {
    case 'Playfair Display':
      return 'var(--font-playfair-display), Georgia, serif';
    case 'Inter':
      return 'var(--font-inter-portal), system-ui, sans-serif';
    case 'Georgia':
      return 'Georgia, "Times New Roman", serif';
    case 'Helvetica':
      return 'Helvetica, Arial, sans-serif';
    default:
      return 'system-ui, sans-serif';
  }
}
