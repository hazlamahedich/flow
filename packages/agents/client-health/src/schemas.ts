import { z } from 'zod';

export const clientHealthInputSchema = z.object({
  workspaceId: z.string().uuid(),
  clientId: z.string().uuid(),
  snapshotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  agentRunId: z.string().uuid(),
  trigger: z.enum(['cron', 'manual']).default('cron'),
});

export type ClientHealthInput = z.infer<typeof clientHealthInputSchema>;

export const overallHealthValues = [
  'healthy',
  'at-risk',
  'critical',
  'neutral',
  'onboarding',
] as const;
export type OverallHealth = (typeof overallHealthValues)[number];

export interface HealthIndicators {
  days_since_last_contact: number;
  unpaid_invoice_count: number;
  time_entry_streak_days: number;
  avg_response_time_hours: number;
  meeting_bypass_count: number;
  last_invoice_paid_at: string | null;
}

export interface ClientHealthProposal {
  snapshotId: string;
  clientId: string;
  engagementScore: number;
  paymentScore: number;
  communicationScore: number;
  overallHealth: OverallHealth;
  indicators: HealthIndicators;
  signalEmitted: boolean;
}

export const clientHealthProposalSchema = z.object({
  snapshotId: z.string().uuid(),
  clientId: z.string().uuid(),
  engagementScore: z.number().int().min(0).max(100),
  paymentScore: z.number().int().min(0).max(100),
  communicationScore: z.number().int().min(0).max(100),
  overallHealth: z.enum(overallHealthValues),
  indicators: z.record(z.unknown()),
  signalEmitted: z.boolean(),
});
