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

  it('should apply client tone override over workspace default', async () => {
    mockSupabase.maybeSingle
      .mockResolvedValueOnce({ data: { tone: 'casual' }, error: null })
      .mockResolvedValueOnce({
        data: {
          style_data: { toneDescriptors: ['professional'], formalityScore: 8 },
          default_tone: 'formal',
          exemplar_emails: [],
        },
        error: null,
      });

    const context = await loadVoiceContext(workspaceId, clientId);

    expect(context.tone).toBe('casual');
    expect(context.tone).not.toBe('formal');
  });

  it('should include per-client tone in generated draft prompt', () => {
    const context = {
      tone: 'casual' as const,
      formalityScore: 6,
      toneDescriptors: ['empathetic', 'professional'],
      exemplarBlock: 'Thanks for reaching out! Let me look into this.',
    };

    const prompt = buildDraftPrompt(context, 'I need help with billing', 'Billing issue', []);

    expect(prompt).toContain('Tone: casual');
    expect(prompt).toContain('empathetic');
    expect(prompt).toContain('professional');
    expect(prompt).toContain('Thanks for reaching out');
  });

  it('should include action items in draft prompt context', () => {
    const context = {
      tone: 'formal' as const,
      formalityScore: 8,
      toneDescriptors: [],
      exemplarBlock: '',
    };

    const actions = [
      { type: 'reply', description: 'Confirm meeting time', confidence: 0.9 },
    ];

    const prompt = buildDraftPrompt(context, 'When is our meeting?', 'Meeting?', actions);

    expect(prompt).toContain('Confirm meeting time');
  });

  it('should use workspace profile when no client override exists', async () => {
    mockSupabase.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: {
          style_data: { toneDescriptors: ['concise'], formalityScore: 7 },
          default_tone: 'professional',
          exemplar_emails: ['Best, Alice'],
        },
        error: null,
      });

    const context = await loadVoiceContext(workspaceId, clientId);

    expect(context.tone).toBe('professional');
    expect(context.toneDescriptors).toContain('concise');
    expect(context.formalityScore).toBe(7);
  });
});
