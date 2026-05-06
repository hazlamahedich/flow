import { z } from 'zod';

export const draftStatusSchema = z.enum(['pending', 'approved', 'rejected', 'edited', 'superseded']);

export const draftResponseSchema = z.object({
  draftContent: z.string().min(1),
  voiceProfileId: z.string().uuid().optional().nullable(),
  trustAtGeneration: z.number().int().min(1).max(3),
});

export const draftJobPayloadSchema = z.object({
  emailId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  clientInboxId: z.string().uuid(),
});

export type DraftStatus = z.infer<typeof draftStatusSchema>;
export type DraftResponse = z.infer<typeof draftResponseSchema>;
export type DraftJobPayload = z.infer<typeof draftJobPayloadSchema>;
