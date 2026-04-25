import { z } from 'zod';

export const approveRunSchema = z.object({
  runId: z.string().uuid(),
});

export const rejectRunSchema = z.object({
  runId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

export const updateProposalSchema = z.object({
  runId: z.string().uuid(),
  title: z.string().min(1).max(200).optional(),
  confidence: z.number().min(0).max(1).optional(),
  riskLevel: z.enum(['low', 'medium', 'high']).optional(),
}).refine(
  (data) => data.title !== undefined || data.confidence !== undefined || data.riskLevel !== undefined,
  { message: 'At least one field must be provided' },
);

export const batchActionSchema = z.object({
  runIds: z.array(z.string().uuid()).min(1).max(25),
});

export const resumeRunSchema = z.object({
  runId: z.string().uuid(),
});

export const cancelRunSchema = z.object({
  runId: z.string().uuid(),
});
