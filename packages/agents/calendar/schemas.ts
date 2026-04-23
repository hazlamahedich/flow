import { z } from 'zod';

export interface CalendarInput {
  workspaceId: string;
  signalId: string;
}

export interface CalendarProposal {
  eventType: string;
  confidence: number;
  reasoning: string;
}

export const calendarInputSchema = z.object({
  workspaceId: z.string().uuid(),
  signalId: z.string().uuid(),
});

export const calendarProposalSchema = z.object({
  eventType: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});
