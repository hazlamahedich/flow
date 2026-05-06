import { z } from 'zod';

export const metricTypeSchema = z.enum(['recategorization_rate', 'draft_acceptance_rate']);

export const inboxTrustMetricsSchema = z.object({
  workspaceId: z.string().uuid(),
  clientInboxId: z.string().uuid(),
  metricType: metricTypeSchema,
  metricValue: z.number().min(0).max(1),
  sampleCount: z.number().int().min(0),
  computedAt: z.string().datetime({ offset: true }),
});

export const recategorizationLogSchema = z.object({
  emailId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  oldCategory: z.string(),
  newCategory: z.string(),
  userId: z.string().uuid(),
});

export const TRUST_THRESHOLDS = {
  MIN_SAMPLES_TRUST_2: 20,
  MAX_RECAT_RATE_TRUST_2: 0.15,
  MIN_SAMPLES_TRUST_3: 50,
  MAX_RECAT_RATE_TRUST_3: 0.10,
  MIN_DRAFT_ACCEPT_TRUST_3: 0.80,
  DRAFT_TRUST_GATE: 2,
} as const;

export const NEW_WORKSPACE_TRUST = 1;

export type TrustLevel = 1 | 2 | 3;
export type MetricType = z.infer<typeof metricTypeSchema>;
export type InboxTrustMetrics = z.infer<typeof inboxTrustMetricsSchema>;
export type RecategorizationLog = z.infer<typeof recategorizationLogSchema>;

// Re-export or define for cross-schema validation if needed
export { toneLevelSchema } from './voice';
