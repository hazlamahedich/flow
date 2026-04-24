import type { TrustLevel } from './types';

export const MS_PER_DAY = 1000 * 60 * 60 * 24;

export const CONFIRM_THRESHOLD_SCORE = 70;
export const AUTO_THRESHOLD_SCORE = 140;
export const CONFIRM_MIN_CONSECUTIVE = 7;
export const AUTO_MIN_CONSECUTIVE = 14;
export const AUTO_MIN_TOTAL_AT_CONFIRM = 20;
export const COOLDOWN_DAYS = 7;
export const CONTEXT_SHIFT_COOLDOWN_DAYS = 3;
export const NO_VIOLATION_DAYS_CONFIRM = 7;
export const NO_VIOLATION_DAYS_AUTO = 14;
export const CONTEXT_SHIFT_DAYS = 30;

interface GraduationRequest {
  currentLevel: TrustLevel;
  score: number;
  consecutiveSuccesses: number;
  totalAtCurrentLevel: number;
  cooldownUntil: Date | null;
  lastViolationAt: Date | null;
  now?: Date;
}

export interface EvaluationResult {
  canGraduate: boolean;
  targetLevel: TrustLevel | null;
  reason: string;
}

export function canGraduate(request: GraduationRequest): boolean {
  const { currentLevel, score, consecutiveSuccesses, cooldownUntil, lastViolationAt, now = new Date() } = request;

  if (currentLevel === 'auto') return false;

  if (cooldownUntil && new Date(cooldownUntil) > now) return false;

  const violationDays = currentLevel === 'supervised' ? NO_VIOLATION_DAYS_CONFIRM : NO_VIOLATION_DAYS_AUTO;
  if (lastViolationAt) {
    const violationDate = new Date(lastViolationAt);
    const msSinceViolation = now.getTime() - violationDate.getTime();
    if (msSinceViolation < violationDays * MS_PER_DAY) return false;
  }

  if (currentLevel === 'supervised') {
    return score >= CONFIRM_THRESHOLD_SCORE && consecutiveSuccesses >= CONFIRM_MIN_CONSECUTIVE;
  }

  if (currentLevel === 'confirm') {
    return (
      score >= AUTO_THRESHOLD_SCORE &&
      consecutiveSuccesses >= AUTO_MIN_CONSECUTIVE &&
      request.totalAtCurrentLevel >= AUTO_MIN_TOTAL_AT_CONFIRM
    );
  }

  return false;
}

export function evaluateTransition(request: GraduationRequest): EvaluationResult {
  if (canGraduate(request)) {
    const target = request.currentLevel === 'supervised' ? 'confirm' : 'auto';
    return {
      canGraduate: true,
      targetLevel: target,
      reason: `Met ${target} thresholds: score=${request.score}, consecutive=${request.consecutiveSuccesses}`,
    };
  }
  return { canGraduate: false, targetLevel: null, reason: 'Thresholds not met or cooldown active' };
}

export function applyViolation(
  currentLevel: TrustLevel,
  violationType: 'soft' | 'hard',
  previousViolationsInWindow: number,
): TrustLevel {
  if (currentLevel === 'auto') {
    if (violationType === 'hard' || previousViolationsInWindow >= 1) {
      return 'supervised';
    }
    return 'confirm';
  }
  if (currentLevel === 'confirm') {
    return 'supervised';
  }
  return 'supervised';
}

export function evaluateContextShift(
  currentLevel: TrustLevel,
  lastActiveAt: Date | null,
  now: Date = new Date(),
): { shouldShift: boolean; targetLevel: TrustLevel | null } {
  if (!lastActiveAt) return { shouldShift: false, targetLevel: null };

  const msInactive = now.getTime() - new Date(lastActiveAt).getTime();
  if (msInactive < CONTEXT_SHIFT_DAYS * MS_PER_DAY) {
    return { shouldShift: false, targetLevel: null };
  }

  if (currentLevel === 'auto') {
    return { shouldShift: true, targetLevel: 'confirm' };
  }
  if (currentLevel === 'confirm') {
    return { shouldShift: true, targetLevel: 'supervised' };
  }
  return { shouldShift: false, targetLevel: null };
}
