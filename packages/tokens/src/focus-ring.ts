export const focusRing = {
  width: '2px',
  offset: '2px',
  color: 'var(--flow-accent-primary)',
  strategy: ':focus-visible',
  darkGlow: '0 0 0 1px var(--flow-accent-primary)',
} as const;

export type FocusRing = typeof focusRing;
