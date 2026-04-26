import { z } from 'zod';

export const SubmitFeedbackSchema = z.object({
  runId: z.string().uuid(),
  sentiment: z.enum(['positive', 'negative']),
  note: z.string().max(500).optional(),
});

export const DeleteFeedbackSchema = z.object({
  feedbackId: z.string().uuid(),
});
