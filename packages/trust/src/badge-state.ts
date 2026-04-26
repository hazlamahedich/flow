import type { TrustMatrixEntry } from './types';

export type TrustBadgeState =
  | 'supervised'
  | 'confirm'
  | 'auto'
  | 'promoting'
  | 'regressing'
  | 'stick_time';

export interface BadgeDisplayProps {
  state: TrustBadgeState;
  label: string;
  colorToken: string;
  borderStyle: string;
  variant: 'inline' | 'sidebar';
}

export const TRUST_BADGE_DISPLAY: Record<
  TrustBadgeState,
  { label: string; colorToken: string; borderStyle: string }
> = {
  supervised: {
    label: 'Learning',
    colorToken: '--flow-emotion-trust-building',
    borderStyle: '1px solid',
  },
  confirm: {
    label: 'Established',
    colorToken: '--flow-emotion-trust-confirm',
    borderStyle: '1px dashed',
  },
  auto: {
    label: 'Auto',
    colorToken: '--flow-emotion-trust-auto',
    borderStyle: 'none',
  },
  promoting: {
    label: 'Promoting',
    colorToken: '--flow-emotion-trust-building',
    borderStyle: '1px solid',
  },
  regressing: {
    label: 'Something changed',
    colorToken: '--flow-emotion-trust-betrayed',
    borderStyle: '1px solid',
  },
  stick_time: {
    label: 'Ready for review?',
    colorToken: '--flow-emotion-trust-auto',
    borderStyle: 'none',
  },
};

export const VALID_BADGE_TRANSITIONS: Record<TrustBadgeState, TrustBadgeState[]> = {
  supervised: ['promoting'],
  promoting: ['confirm', 'supervised', 'auto'],
  confirm: ['promoting', 'regressing'],
  auto: ['stick_time', 'regressing'],
  stick_time: ['auto', 'regressing'],
  regressing: ['confirm'],
};

export class InvalidTransitionError extends Error {
  public readonly from: TrustBadgeState;
  public readonly to: TrustBadgeState;

  constructor(from: TrustBadgeState, to: TrustBadgeState) {
    super(`Invalid badge transition: ${from} → ${to}`);
    this.name = 'InvalidTransitionError';
    this.from = from;
    this.to = to;
  }
}

const MS_PER_DAY = 86_400_000;

export function deriveBadgeState(entry: TrustMatrixEntry, now: Date): TrustBadgeState {
  const level = entry.currentLevel;
  const consecutive = entry.consecutiveSuccesses;
  const score = entry.score;
  const lastTransition = new Date(entry.lastTransitionAt);
  const transitionTime = lastTransition.getTime();
  const daysAtLevel = Number.isFinite(transitionTime)
    ? (now.getTime() - transitionTime) / MS_PER_DAY
    : 0;

  if (level === 'supervised') {
    if (score >= 70 && consecutive >= 7) return 'promoting';
    return 'supervised';
  }

  if (level === 'confirm') {
    if (score >= 140 && consecutive >= 14 && entry.totalExecutions >= 20) return 'promoting';
    return 'confirm';
  }

  if (level === 'auto') {
    if (daysAtLevel >= 30) return 'stick_time';
    return 'auto';
  }

  return level;
}

/**
 * `regressing` is a mutation-only state — it is set externally via atom
 * mutation when a violation triggers a trust regression. It is never
 * produced by `deriveBadgeState` because the derivation operates on
 * the current persisted trust level, and regressing is a transient
 * UI state that precedes the level actually changing in the database.
 */

export function assertValidBadgeTransition(from: TrustBadgeState, to: TrustBadgeState): void {
  const allowed = VALID_BADGE_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new InvalidTransitionError(from, to);
  }
}
