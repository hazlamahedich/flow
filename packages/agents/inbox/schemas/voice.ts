import { z } from 'zod';

export const toneLevelSchema = z.enum(['casual', 'professional', 'formal']);

export const styleDataSchema = z.object({
  toneDescriptors: z.array(z.string()),
  avgSentenceLength: z.number(),
  formalityScore: z.number().min(0).max(10),
});

export const voiceProfileSchema = z.object({
  workspaceId: z.string().uuid(),
  styleData: styleDataSchema,
  exemplarEmails: z.array(z.string()),
  defaultTone: toneLevelSchema,
});

export const clientToneOverrideSchema = z.object({
  workspaceId: z.string().uuid(),
  clientId: z.string().uuid(),
  tone: toneLevelSchema,
  notes: z.string().optional().nullable(),
});

export const DEFAULT_STYLE_DATA = {
  toneDescriptors: ['professional', 'concise', 'helpful'],
  avgSentenceLength: 15,
  formalityScore: 7,
} as const;

export type ToneLevel = z.infer<typeof toneLevelSchema>;
export type StyleData = z.infer<typeof styleDataSchema>;
export type VoiceProfile = z.infer<typeof voiceProfileSchema>;
export type ClientToneOverride = z.infer<typeof clientToneOverrideSchema>;
