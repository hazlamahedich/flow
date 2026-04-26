import { z } from 'zod';

export const DeferCheckInSchema = z.object({
  workspaceId: z.string().uuid(),
  agentId: z.string().min(1),
});

export const AcknowledgeCheckInSchema = z.object({
  workspaceId: z.string().uuid(),
  agentId: z.string().min(1),
});

export const TrustEventFilterSchema = z.object({
  agentId: z.string().optional(),
  direction: z.enum(['upgrade', 'regression', 'all']).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
});

export type DeferCheckInInput = z.infer<typeof DeferCheckInSchema>;
export type AcknowledgeCheckInInput = z.infer<typeof AcknowledgeCheckInSchema>;
export type TrustEventFilterInput = z.infer<typeof TrustEventFilterSchema>;
