import { z } from 'zod';

export const weeklyReportInputSchema = z.object({
  workspaceId: z.string().uuid(),
  clientId: z.string().uuid(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  agentRunId: z.string().uuid(),
  trigger: z.enum(['cron', 'manual']).default('cron'),
});

export type WeeklyReportInput = z.infer<typeof weeklyReportInputSchema>;

export const weeklyReportProposalSchema = z.object({
  reportId: z.string().uuid().optional(),
  title: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  riskLevel: z.enum(['low', 'medium', 'high']).default('low'),
  preview: z.string(),
});

export type WeeklyReportProposal = z.infer<typeof weeklyReportProposalSchema>;
