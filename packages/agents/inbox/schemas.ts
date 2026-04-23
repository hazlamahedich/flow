import { z } from 'zod';

export interface InboxInput {
  workspaceId: string;
  signalId: string;
}

export interface InboxProposal {
  category: string;
  confidence: number;
  reasoning: string;
}

export const inboxInputSchema = z.object({
  workspaceId: z.string().uuid(),
  signalId: z.string().uuid(),
});

export const inboxProposalSchema = z.object({
  category: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});
