import { z } from 'zod';

export const processingStateSchema = z.enum([
  'categorized',
  'extraction_pending',
  'extraction_complete',
  'extraction_skipped',
  'draft_pending',
  'draft_complete',
  'draft_deferred',
]);

export type ProcessingState = z.infer<typeof processingStateSchema>;

export const VALID_TRANSITIONS: Record<ProcessingState, ProcessingState[]> = {
  categorized: ['extraction_pending'],
  extraction_pending: ['extraction_complete', 'extraction_skipped'],
  extraction_complete: ['draft_pending', 'draft_complete', 'draft_deferred'],
  extraction_skipped: ['extraction_pending'],
  draft_pending: ['draft_complete', 'draft_deferred'],
  draft_complete: ['extraction_pending', 'extraction_skipped'],
  draft_deferred: ['draft_pending', 'draft_complete'],
};

export function isValidTransition(from: ProcessingState, to: ProcessingState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export const FLOOD_THRESHOLD = 31;

export const emailProcessingStateSchema = z.object({
  emailId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  state: processingStateSchema,
  updatedAt: z.string().datetime({ offset: true }),
});

export type EmailProcessingState = z.infer<typeof emailProcessingStateSchema>;
