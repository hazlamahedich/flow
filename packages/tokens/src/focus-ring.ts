export const focusRing = {
  width: '2px',
  offset: '2px',
  color: 'var(--flow-accent-primary)',
  strategy: ':focus-visible',
} as const;

export type FocusRing = typeof focusRing;
