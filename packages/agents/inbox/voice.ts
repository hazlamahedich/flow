import { createServiceClient } from '@flow/db';
import { DEFAULT_STYLE_DATA, ToneLevel, StyleData, toneLevelSchema } from './schemas/voice';

export interface VoiceContext {
  tone: ToneLevel;
  formalityScore: number;
  toneDescriptors: string[];
  exemplarBlock: string;
}

export const EMPTY_VOICE_CONTEXT: VoiceContext = {
  tone: 'professional',
  formalityScore: 7,
  toneDescriptors: ['professional', 'concise', 'helpful'],
  exemplarBlock: '',
};

export async function loadVoiceContext(workspaceId: string, clientId: string): Promise<VoiceContext> {
  const supabase = createServiceClient();

  // Try client override first
  const { data: override } = await supabase
    .from('client_tone_overrides')
    .select('tone')
    .eq('workspace_id', workspaceId)
    .eq('client_id', clientId)
    .maybeSingle();

  // Load workspace profile
  const { data: profile } = await supabase
    .from('workspace_voice_profiles')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (!profile) {
    return {
      ...EMPTY_VOICE_CONTEXT,
      tone: (override?.tone as ToneLevel) || EMPTY_VOICE_CONTEXT.tone,
    };
  }

  const styleData = (profile.style_data as unknown as StyleData) || DEFAULT_STYLE_DATA;
  
  const rawTone = (override?.tone as ToneLevel) || (profile.default_tone as ToneLevel);
  const tone = toneLevelSchema.safeParse(rawTone).success ? rawTone : EMPTY_VOICE_CONTEXT.tone;

  const exemplars = (profile.exemplar_emails as string[]) || [];
  const exemplarBlock =
    exemplars.length > 0
      ? `Exemplar emails for style reference:\n\n${exemplars
          .map((e, i) => `Example ${i + 1}:\n${e}`)
          .join('\n\n')}`
      : '';

  return {
    tone,
    formalityScore: styleData.formalityScore ?? DEFAULT_STYLE_DATA.formalityScore,
    toneDescriptors: styleData.toneDescriptors ?? DEFAULT_STYLE_DATA.toneDescriptors,
    exemplarBlock,
  };
}

export function buildDraftPrompt(
  voiceContext: VoiceContext,
  emailContent: string,
  subject: string,
  actions: { description: string; actionType: string }[]
): string {
  const actionSummary =
    actions.length > 0
      ? `The following action items were extracted and should be addressed in the response:\n${actions
          .map((a) => `- ${a.description} (${a.actionType})`)
          .join('\n')}`
      : 'No specific action items were extracted, but a polite acknowledgment or helpful response is needed.';

  return `
Write a draft email response based on the following context.

TARGET VOICE PROFILE:
- Tone: ${voiceContext.tone}
- Formality: ${voiceContext.formalityScore}/10
- Style Keywords: ${voiceContext.toneDescriptors.join(', ')}

${voiceContext.exemplarBlock}

ORIGINAL EMAIL:
Subject: ${subject}
Content:
${emailContent}

ACTION ITEMS TO ADDRESS:
${actionSummary}

INSTRUCTIONS:
- Match the target voice profile exactly.
- Be concise and professional.
- Address all action items clearly.
- If no action items, write a helpful acknowledgment.
- Output ONLY the email body content. Do not include subject line or placeholders like [Your Name].
`.trim();
}
