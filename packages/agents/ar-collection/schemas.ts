import { z } from 'zod';

export interface ArCollectionInput {
  workspaceId: string;
  signalId: string;
}

export interface ArCollectionProposal {
  actionType: string;
  confidence: number;
  reasoning: string;
}

export const arCollectionInputSchema = z.object({
  workspaceId: z.string().uuid(),
  signalId: z.string().uuid(),
});

export const arCollectionProposalSchema = z.object({
  actionType: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});
