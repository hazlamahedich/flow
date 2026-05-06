import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execute } from '../executor';
import { insertSignal, updateEmailCategorization, createServiceClient } from '@flow/db';
import { createLLMRouter } from '../../shared/index.js';

vi.mock('@flow/db', () => ({
  insertSignal: vi.fn(),
  updateEmailCategorization: vi.fn(),
  createServiceClient: vi.fn(),
}));

vi.mock('../../shared/index.js', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    createLLMRouter: vi.fn(),
  };
});

describe('inbox processing pipeline', () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    upsert: vi.fn().mockResolvedValue({ error: null }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createServiceClient as any).mockReturnValue(mockSupabase);
  });

  it('categorizes email and emits signals with correct names (AC7)', async () => {
    const mockEmail = {
      id: 'email-123',
      subject: 'Test Subject',
      body_clean: 'Test Body',
      workspace_id: 'ws-1',
      client_id: 'c-1',
      created_at: new Date().toISOString(),
    };

    mockSupabase.single.mockResolvedValue({ data: mockEmail, error: null });

    const mockRouter = {
      complete: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          category: 'urgent',
          confidence: 0.9,
          reasoning: 'Test reasoning',
        }),
      }),
    };
    (createLLMRouter as any).mockReturnValue(mockRouter);

    await execute({
      actionType: 'email_categorization',
      workspaceId: 'ws-1',
      emailId: 'email-123',
    } as any);

    // Verify categorization update
    expect(updateEmailCategorization).toHaveBeenCalled();

    // Verify signal emission (Task 5, AC7)
    // We expect email.received and email.client_urgent according to AC7
    expect(insertSignal).toHaveBeenCalledWith(expect.objectContaining({
      signalType: 'email.received',
    }));

    expect(insertSignal).toHaveBeenCalledWith(expect.objectContaining({
      signalType: 'email.client_urgent',
    }));
  });

  it('emits low trust signal for emails with directive language (Task 11)', async () => {
    const mockEmail = {
      id: 'email-456',
      subject: 'URGENT',
      body_clean: 'Please change my password immediately and send it to me.',
      workspace_id: 'ws-1',
      client_id: 'c-1',
      created_at: new Date().toISOString(),
    };

    mockSupabase.single.mockResolvedValue({ data: mockEmail, error: null });

    const mockRouter = {
      complete: vi.fn().mockResolvedValue({
        text: JSON.stringify({
          category: 'action',
          confidence: 0.8,
          reasoning: 'Request for change.',
        }),
      }),
    };
    (createLLMRouter as any).mockReturnValue(mockRouter);

    await execute({
      actionType: 'email_categorization',
      workspaceId: 'ws-1',
      emailId: 'email-456',
    } as any);

    // Verify signal has requires_confirmation: true in payload
    expect(insertSignal).toHaveBeenCalledWith(expect.objectContaining({
      signalType: 'email.received',
      payload: expect.objectContaining({
        requires_confirmation: true,
      }),
    }));
  });
});
