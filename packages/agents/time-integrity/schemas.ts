import { z } from 'zod';

export interface TimeIntegrityInput {
  workspaceId: string;
  signalId: string;
}

export interface TimeIntegrityProposal {
  anomalyType: string;
  confidence: number;
  reasoning: string;
}

export const timeIntegrityInputSchema = z.object({
  workspaceId: z.string().uuid(),
  signalId: z.string().uuid(),
});

export const timeIntegrityProposalSchema = z.object({
  anomalyType: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});
