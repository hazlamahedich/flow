import type { TrustLevel } from './types';

export function applyViolationRollback(
  currentLevel: TrustLevel,
  severity: 'soft' | 'hard',
  previousViolationsInWindow: number,
): TrustLevel {
  if (currentLevel === 'supervised') {
    return 'supervised';
  }

  if (currentLevel === 'auto') {
    if (severity === 'hard' || previousViolationsInWindow >= 1) {
      return 'supervised';
    }
    return 'confirm';
  }

  return 'supervised';
}
