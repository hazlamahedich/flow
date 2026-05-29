import { z } from 'zod';

export const fridayFeelingInputSchema = z.object({
  workspaceId: z.string().uuid(),
  userId: z.string().uuid(),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weekEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  agentRunId: z.string().uuid(),
  trigger: z.enum(['cron', 'manual']).default('cron'),
});

export type FridayFeelingInput = z.infer<typeof fridayFeelingInputSchema>;

export interface TrustTransition {
  agent_type: string;
  from_level: string;
  to_level: string;
  reached_at: string;
}

export interface FridayFeelingResult {
  summaryId: string;
  tasksHandled: number;
  timeSavedMinutes: number;
  trustMilestones: TrustTransition[];
  headline: string;
}

const trustTransitionSchema = z.object({
  agent_type: z.string(),
  from_level: z.string(),
  to_level: z.string(),
  reached_at: z.string(),
});

export const fridayFeelingResultSchema = z.object({
  summaryId: z.string().uuid(),
  tasksHandled: z.number().int().min(0),
  timeSavedMinutes: z.number().int().min(0),
  trustMilestones: z.array(trustTransitionSchema),
  headline: z.string(),
});

export interface WednesdayAffirmationInput {
  workspaceId: string;
  agentRunId: string;
  trigger: 'cron' | 'manual';
}

export interface WednesdayAffirmationResult {
  affirmationIds: string[];
  generated: number;
}
