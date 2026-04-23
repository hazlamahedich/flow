import { z } from 'zod';

export interface WeeklyReportInput {
  workspaceId: string;
  signalId: string;
}

export interface WeeklyReportProposal {
  reportType: string;
  confidence: number;
  reasoning: string;
}

export const weeklyReportInputSchema = z.object({
  workspaceId: z.string().uuid(),
  signalId: z.string().uuid(),
});

export const weeklyReportProposalSchema = z.object({
  reportType: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});
