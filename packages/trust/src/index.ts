export {
  TrustLevelSchema,
  AgentIdSchema,
  TrustDecisionSchema,
  GraduationSuggestionSchema,
  TransitionCauseSchema,
  RiskWeightSchema,
  TrustMatrixEntrySchema,
  TrustSnapshotSchema,
} from './types';

export type {
  TrustLevel,
  AgentId,
  TrustDecision,
  GraduationSuggestion,
  TransitionCause,
  RiskWeight,
  TrustMatrixEntry,
  TrustSnapshot,
} from './types';

export { TrustTransitionError } from './errors';
export type { TrustTransitionErrorCode } from './errors';

export { RISK_WEIGHTS, RISK_WEIGHT_ENTRIES } from './risk-weights';
export type { RiskWeightEntry } from './risk-weights';
export { calculateScoreChange, applyScoreChange, getRiskWeight } from './scoring';
export type { TrustEvent } from './scoring';
export {
  canGraduate,
  evaluateTransition,
  applyViolation,
  evaluateContextShift,
  CONFIRM_THRESHOLD_SCORE,
  AUTO_THRESHOLD_SCORE,
  CONFIRM_MIN_CONSECUTIVE,
  AUTO_MIN_CONSECUTIVE,
  AUTO_MIN_TOTAL_AT_CONFIRM,
  COOLDOWN_DAYS,
  CONTEXT_SHIFT_COOLDOWN_DAYS,
  NO_VIOLATION_DAYS_CONFIRM,
  NO_VIOLATION_DAYS_AUTO,
  CONTEXT_SHIFT_DAYS,
  MS_PER_DAY,
} from './graduation';
export type { EvaluationResult } from './graduation';
export { evaluatePreconditions } from './pre-check';
export { applyViolationRollback } from './rollback';
export { createTrustClient } from './client/trust-client';
export type { TrustClient, TrustClientDeps, MatrixEntry } from './client/trust-client';
