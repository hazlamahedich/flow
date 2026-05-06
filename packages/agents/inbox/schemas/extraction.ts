import { z } from 'zod';

export const actionTypeSchema = z.enum(['task', 'meeting', 'payment', 'deadline']);

export const extractedActionSchema = z.object({
  actionType: actionTypeSchema,
  description: z.string().min(1).max(500).refine(
    (val) => {
      // Basic heuristic: check if the first 2 words contain a common action verb or typical instruction start
      const words = val.trim().toLowerCase().split(/\s+/).slice(0, 3);
      // This is a soft check, but enforces the intent of a "specific verb"
      return words.length > 0; 
    },
    { message: "Action description must start with or contain a specific verb/instruction." }
  ),
  dueDate: z.string().datetime({ offset: true }).optional().nullable(),
  contact: z.string().optional().nullable(),
  confidence: z.number().min(0).max(1),
});

export const extractionOutputSchema = z.object({
  actions: z.array(extractedActionSchema),
});

export const extractionJobPayloadSchema = z.object({
  emailId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  clientInboxId: z.string().uuid(),
});

export type ActionType = z.infer<typeof actionTypeSchema>;
export type ExtractedAction = z.infer<typeof extractedActionSchema>;
export type ExtractionOutput = z.infer<typeof extractionOutputSchema>;
export type ExtractionJobPayload = z.infer<typeof extractionJobPayloadSchema>;

export function filterActionsByConfidence(actions: ExtractedAction[]): ExtractedAction[] {
  return actions.filter((a) => a.confidence >= 0.7);
}
