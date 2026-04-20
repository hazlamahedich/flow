export const duration = {
  instant: '50ms',
  fast: '100ms',
  normal: '150ms',
  expressive: '300ms',
  ceremony: '500ms',
} as const;

export const easing = {
  standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
  decelerate: 'cubic-bezier(0, 0, 0.2, 1)',
  accelerate: 'cubic-bezier(0.4, 0, 1, 1)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  gentle: 'cubic-bezier(0.4, 0, 0.6, 1)',
} as const;

export const reducedMotionDuration = {
  instant: '0ms',
  fast: '0ms',
  normal: '0ms',
  expressive: '0ms',
  ceremony: '100ms',
} as const;

export type Duration = typeof duration;
export type Easing = typeof easing;
