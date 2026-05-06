import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadVoiceContext, buildDraftPrompt, EMPTY_VOICE_CONTEXT } from '../voice';
import { createServiceClient } from '@flow/db';

vi.mock('@flow/db', () => ({
  createServiceClient: vi.fn(),
}));

describe('voice-profile', () => {
  const workspaceId = 'w1111111-1111-1111-1111-111111111111';
  const clientId = 'c1111111-1111-1111-1111-111111111111';
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
    };
    (createServiceClient as any).mockReturnValue(mockSupabase);
  });

  it('should return default context if no profile or override exists', async () => {
    mockSupabase.maybeSingle.mockResolvedValue({ data: null, error: null });

    const context = await loadVoiceContext(workspaceId, clientId);

    expect(context.tone).toBe(EMPTY_VOICE_CONTEXT.tone);
    expect(context.formalityScore).toBe(EMPTY_VOICE_CONTEXT.formalityScore);
  });

  it('should apply client tone override', async () => {
    mockSupabase.maybeSingle
      .mockResolvedValueOnce({ data: { tone: 'formal' }, error: null }) // Override
      .mockResolvedValueOnce({ data: null, error: null }); // Profile

    const context = await loadVoiceContext(workspaceId, clientId);

    expect(context.tone).toBe('formal');
  });

  it('should load workspace voice profile', async () => {
    mockSupabase.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null }) // Override
      .mockResolvedValueOnce({
        data: {
          style_data: { toneDescriptors: ['witty'], formalityScore: 5 },
          default_tone: 'casual',
          exemplar_emails: ['Email 1'],
        },
        error: null,
      });

    const context = await loadVoiceContext(workspaceId, clientId);

    expect(context.tone).toBe('casual');
    expect(context.toneDescriptors).toContain('witty');
    expect(context.exemplarBlock).toContain('Email 1');
  });

  it('should include voice context in draft prompt', () => {
    const context = {
      tone: 'casual' as const,
      formalityScore: 5,
      toneDescriptors: ['friendly'],
      exemplarBlock: 'Example style content',
    };

    const prompt = buildDraftPrompt(context, 'Hello', 'Subject', []);

    expect(prompt).toContain('Tone: casual');
    expect(prompt).toContain('Formality: 5/10');
    expect(prompt).toContain('Example style content');
  });
});
