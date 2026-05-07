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

export const getHandledEmailsSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
});

export const promoteToInboxSchema = z.object({
  emailId: z.string().uuid(),
});

export const reviewAllSchema = z.object({
  emailIds: z.array(z.string().uuid()).min(1).max(50),
});

export const approveDraftSchema = z.object({
  draftId: z.string().uuid(),
});

export const rejectDraftSchema = z.object({
  draftId: z.string().uuid(),
  reason: z.string().min(1).max(500).optional(),
});

export const editDraftSchema = z.object({
  draftId: z.string().uuid(),
  content: z.string().min(1).max(10000),
});

export const quickEditToneSchema = z.object({
  draftId: z.string().uuid(),
  tone: z.enum(['professional', 'friendly', 'concise', 'detailed']),
});

export const quickEditLengthSchema = z.object({
  draftId: z.string().uuid(),
  length: z.enum(['shorter', 'longer']),
});


