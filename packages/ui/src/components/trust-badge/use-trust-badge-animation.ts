'use client';

import { useReducedMotion } from '../../hooks/use-reduced-motion';

type AnimState = 'default' | 'promoting' | 'regressing';

const PROMOTION_TRANSITION = 'border-color 300ms ease, transform 100ms ease';

export function useTrustBadgeAnimation(state: AnimState): React.CSSProperties {
  const prefersReduced = useReducedMotion();

  if (prefersReduced) {
    return { transition: 'none' };
  }

  if (state === 'promoting') {
    return {
      transition: PROMOTION_TRANSITION,
      animation: 'pulse-trust 500ms ease-in-out',
    };
  }

  if (state === 'regressing') {
    return { transition: 'background-color 200ms ease' };
  }

  return { transition: 'none' };
}
