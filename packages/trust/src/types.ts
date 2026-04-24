import { z } from 'zod';

export const TrustLevelSchema = z.enum(['supervised', 'confirm', 'auto']);
export type TrustLevel = z.infer<typeof TrustLevelSchema>;

export const AgentIdSchema = z.enum([
  'inbox',
  'calendar',
  'ar-collection',
  'weekly-report',
  'client-health',
  'time-integrity',
]);
export type AgentId = z.infer<typeof AgentIdSchema>;

export const TrustDecisionSchema = z.object({
  allowed: z.boolean(),
  level: TrustLevelSchema,
  reason: z.string(),
  snapshotId: z.string().optional(),
  preconditionsPassed: z.boolean(),
  failedPreconditionKey: z.string().optional(),
});
export type TrustDecision = z.infer<typeof TrustDecisionSchema>;

export const GraduationSuggestionSchema = z.object({
  fromLevel: TrustLevelSchema,
  toLevel: TrustLevelSchema,
  agentId: AgentIdSchema,
  actionType: z.string(),
  reason: z.string(),
  eligibleAt: z.date(),
});
export type GraduationSuggestion = z.infer<typeof GraduationSuggestionSchema>;

export const TransitionCauseSchema = z.enum([
  'graduation',
  'soft_violation',
  'hard_violation',
  'precheck_failure',
  'manual_override',
  'context_shift',
]);
export type TransitionCause = z.infer<typeof TransitionCauseSchema>;

export const RiskWeightSchema = z.object({
  agentId: AgentIdSchema,
  actionType: z.string(),
  weight: z.number().min(0).max(5),
});
export type RiskWeight = z.infer<typeof RiskWeightSchema>;

export const TrustMatrixEntrySchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  agentId: AgentIdSchema,
  actionType: z.string(),
  currentLevel: TrustLevelSchema,
  score: z.number().int().min(0).max(200),
  totalExecutions: z.number().int().min(0),
  successfulExecutions: z.number().int().min(0),
  consecutiveSuccesses: z.number().int().min(0),
  violationCount: z.number().int().min(0),
  lastTransitionAt: z.date(),
  lastViolationAt: z.date().nullable(),
  cooldownUntil: z.date().nullable(),
  version: z.number().int().min(1),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type TrustMatrixEntry = z.infer<typeof TrustMatrixEntrySchema>;

export const TrustSnapshotSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid(),
  executionId: z.string().uuid(),
  agentId: AgentIdSchema,
  actionType: z.string(),
  matrixVersion: z.number().int(),
  level: TrustLevelSchema,
  score: z.number().int(),
  snapshotHash: z.string(),
  createdAt: z.date(),
});
export type TrustSnapshot = z.infer<typeof TrustSnapshotSchema>;
