import { z } from 'zod';
import { agentIdSchema } from '@flow/types';

export const setTrustLevelSchema = z.object({
  agentId: agentIdSchema,
  actionType: z.string().min(1),
  level: z.enum(['supervised', 'confirm', 'auto']),
  expectedVersion: z.number().int().min(1),
});

export const createPreconditionSchema = z.object({
  agentId: agentIdSchema,
  actionType: z.string().min(1),
  conditionKey: z.string().min(1).max(100),
  conditionExpr: z.string().min(1).max(500),
});

export const deletePreconditionSchema = z.object({
  id: z.string().uuid(),
});

export const getTrustMatrixSchema = z.object({});

export type SetTrustLevelInput = z.infer<typeof setTrustLevelSchema>;
export type CreatePreconditionInput = z.infer<typeof createPreconditionSchema>;
export type DeletePreconditionInput = z.infer<typeof deletePreconditionSchema>;
