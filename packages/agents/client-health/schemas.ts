import { z } from 'zod';

export interface ClientHealthInput {
  workspaceId: string;
  signalId: string;
}

export interface ClientHealthProposal {
  healthStatus: string;
  confidence: number;
  reasoning: string;
}

export const clientHealthInputSchema = z.object({
  workspaceId: z.string().uuid(),
  signalId: z.string().uuid(),
});

export const clientHealthProposalSchema = z.object({
  healthStatus: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});
