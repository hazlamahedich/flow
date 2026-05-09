import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@flow/db', () => ({
  createServiceClient: vi.fn(),
  insertSignal: vi.fn(),
  updateEmailCategorization: vi.fn(),
}));

vi.mock('../history-worker', () => ({
  handleDrainHistory: vi.fn(),
}));

vi.mock('../categorizer', () => ({
  categorizeEmail: vi.fn(),
}));

vi.mock('../index', () => ({
  generateMorningBrief: vi.fn(),
}));

vi.mock('../state-machine', () => ({
  transitionState: vi.fn(),
}));

vi.mock('../../orchestrator/pg-boss-producer.js', () => ({
  PgBossProducer: vi.fn().mockImplementation(() => ({
    submit: vi.fn(),
  })),
}));

vi.mock('../../orchestrator/boss-di.js', () => ({
  getBossInstance: vi.fn().mockReturnValue({ send: vi.fn() }),
}));

import { execute } from '../executor';
import { createServiceClient, insertSignal, updateEmailCategorization } from '@flow/db';
import { handleDrainHistory } from '../history-worker';
import { categorizeEmail } from '../categorizer';
import { generateMorningBrief } from '../index';
import { transitionState } from '../state-machine';
import { getBossInstance } from '../../orchestrator/boss-di.js';

describe('inbox executor', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };
    (createServiceClient as any).mockReturnValue(mockSupabase);
  });

  describe('email_processing action', () => {
    it('delegates to handleDrainHistory', async () => {
      (handleDrainHistory as any).mockResolvedValue(undefined);

      await execute({
        actionType: 'email_processing',
        workspaceId: 'ws-1',
        clientInboxId: 'inbox-1',
        payloadId: 'payload-1',
        signalId: 'sig-1',
      });

      expect(handleDrainHistory).toHaveBeenCalledWith({
        workspace_id: 'ws-1',
        payloadId: 'payload-1',
        clientInboxId: 'inbox-1',
      });
    });
  });

  describe('morning_brief_generation action', () => {
    it('delegates to generateMorningBrief', async () => {
      (generateMorningBrief as any).mockResolvedValue({ id: 'brief-1' });

      await execute({
        actionType: 'morning_brief_generation',
        workspaceId: 'ws-1',
        signalId: 'sig-1',
      });

      expect(generateMorningBrief).toHaveBeenCalledWith('ws-1');
    });
  });

  describe('email_categorization action', () => {
    const emailData = {
      id: 'email-1',
      subject: 'Test subject',
      body_clean: 'Clean body',
      workspace_id: 'ws-1',
      client_id: 'client-1',
      created_at: new Date().toISOString(),
    };

    it('fetches email, categorizes, updates DB, and emits signal', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: emailData, error: null });
      (categorizeEmail as any).mockResolvedValue({
        category: 'urgent',
        confidence: 0.95,
        requires_confirmation: false,
        reasoning: 'Time-sensitive request',
      });
      mockSupabase.single.mockResolvedValueOnce({ data: { id: 'inbox-1' }, error: null });
      (updateEmailCategorization as any).mockResolvedValue(undefined);
      (insertSignal as any).mockResolvedValue(undefined);
      (transitionState as any).mockResolvedValue(undefined);
      (getBossInstance as any).mockReturnValue({ send: vi.fn() });

      const result = await execute({
        actionType: 'email_categorization',
        workspaceId: 'ws-1',
        emailId: 'email-1',
        signalId: 'sig-1',
      });

      expect(categorizeEmail).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'Test subject', body_clean: 'Clean body' }),
      );
      expect(updateEmailCategorization).toHaveBeenCalled();
      expect(insertSignal).toHaveBeenCalledWith(
        expect.objectContaining({ signalType: 'email.received' }),
      );
      expect(insertSignal).toHaveBeenCalledWith(
        expect.objectContaining({ signalType: 'email.client_urgent' }),
      );
      if (result) expect(result.category).toBe('urgent');
    });

    it('throws when email not found', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: new Error('Not found') });

      await expect(
        execute({
          actionType: 'email_categorization',
          workspaceId: 'ws-1',
          emailId: 'missing',
          signalId: 'sig-missing',
        }),
      ).rejects.toThrow('Email not found: missing');
    });

    it('emits email.low_trust signal when requires_confirmation is true', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: emailData, error: null });
      (categorizeEmail as any).mockResolvedValue({
        category: 'action',
        confidence: 0.55,
        requires_confirmation: true,
        reasoning: 'Low confidence',
      });
      mockSupabase.single.mockResolvedValueOnce({ data: { id: 'inbox-1' }, error: null });
      (updateEmailCategorization as any).mockResolvedValue(undefined);
      (insertSignal as any).mockResolvedValue(undefined);
      (transitionState as any).mockResolvedValue(undefined);
      (getBossInstance as any).mockReturnValue({ send: vi.fn() });

      await execute({
        actionType: 'email_categorization',
        workspaceId: 'ws-1',
        emailId: 'email-1',
        signalId: 'sig-1',
      });

      expect(insertSignal).toHaveBeenCalledWith(
        expect.objectContaining({ signalType: 'email.low_trust' }),
      );
    });

    it('does not emit urgent/low_trust signal for info/noise categories', async () => {
      mockSupabase.single.mockResolvedValueOnce({ data: emailData, error: null });
      (categorizeEmail as any).mockResolvedValue({
        category: 'info',
        confidence: 0.9,
        requires_confirmation: false,
        reasoning: 'Newsletter',
      });
      (updateEmailCategorization as any).mockResolvedValue(undefined);
      (insertSignal as any).mockResolvedValue(undefined);

      await execute({
        actionType: 'email_categorization',
        workspaceId: 'ws-1',
        emailId: 'email-1',
        signalId: 'sig-1',
      });

      const signalCalls = (insertSignal as any).mock.calls;
      const urgentOrLow = signalCalls.filter(
        (c: any) => c[0].signalType === 'email.client_urgent' || c[0].signalType === 'email.low_trust',
      );
      expect(urgentOrLow).toHaveLength(0);
    });
  });

  describe('unknown action type', () => {
    it('throws error for unrecognized action type', async () => {
      await expect(
        execute({ actionType: 'unknown' } as any),
      ).rejects.toThrow('inbox.execute: unknown action type or not implemented');
    });
  });
});
