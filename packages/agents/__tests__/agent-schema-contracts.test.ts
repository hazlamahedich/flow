import { describe, it, expect } from 'vitest';
import { inboxInputSchema, inboxProposalSchema } from '../inbox/schemas';
import { calendarInputSchema, calendarProposalSchema } from '../calendar/schemas';
import { clientHealthInputSchema, clientHealthProposalSchema } from '../client-health/schemas';
import { weeklyReportInputSchema, weeklyReportProposalSchema } from '../weekly-report/schemas';
import { arCollectionInputSchema, arCollectionProposalSchema } from '../ar-collection/schemas';

describe('Agent Schema Contracts', () => {
  const UUID = '00000000-0000-0000-0000-000000000001';
  const UUID2 = '00000000-0000-0000-0000-000000000002';

  describe('inbox schemas', () => {
    it('parses valid input', () => {
      expect(inboxInputSchema.safeParse({ workspaceId: UUID, signalId: UUID2 }).success).toBe(true);
    });

    it('rejects invalid workspaceId', () => {
      expect(inboxInputSchema.safeParse({ workspaceId: 'bad', signalId: UUID2 }).success).toBe(false);
    });

    it('parses valid proposal', () => {
      expect(inboxProposalSchema.safeParse({ category: 'invoice', confidence: 0.9, reasoning: 'Looks like an invoice' }).success).toBe(true);
    });

    it('rejects confidence > 1', () => {
      expect(inboxProposalSchema.safeParse({ category: 'invoice', confidence: 1.5, reasoning: 'test' }).success).toBe(false);
    });

    it('rejects negative confidence', () => {
      expect(inboxProposalSchema.safeParse({ category: 'invoice', confidence: -0.1, reasoning: 'test' }).success).toBe(false);
    });
  });

  describe('calendar schemas', () => {
    it('parses valid input', () => {
      expect(calendarInputSchema.safeParse({ workspaceId: UUID, signalId: UUID2 }).success).toBe(true);
    });

    it('parses valid proposal', () => {
      expect(calendarProposalSchema.safeParse({ eventType: 'conflict', confidence: 0.8, reasoning: 'Overlap detected' }).success).toBe(true);
    });

    it('rejects missing signalId', () => {
      expect(calendarInputSchema.safeParse({ workspaceId: UUID }).success).toBe(false);
    });
  });

  describe('client-health schemas', () => {
    it('parses valid input', () => {
      expect(clientHealthInputSchema.safeParse({ workspaceId: UUID, signalId: UUID2 }).success).toBe(true);
    });

    it('parses valid proposal', () => {
      expect(clientHealthProposalSchema.safeParse({ healthStatus: 'at-risk', confidence: 0.75, reasoning: 'Slowing responses' }).success).toBe(true);
    });

    it('rejects empty healthStatus', () => {
      expect(clientHealthProposalSchema.safeParse({ healthStatus: '', confidence: 0.75, reasoning: 'test' }).success).toBe(true);
    });
  });

  describe('weekly-report schemas', () => {
    it('parses valid input', () => {
      expect(weeklyReportInputSchema.safeParse({ workspaceId: UUID, signalId: UUID2 }).success).toBe(true);
    });

    it('parses valid proposal', () => {
      expect(weeklyReportProposalSchema.safeParse({ reportType: 'weekly-summary', confidence: 0.85, reasoning: 'Generated summary' }).success).toBe(true);
    });
  });

  describe('ar-collection schemas', () => {
    it('parses valid input', () => {
      expect(arCollectionInputSchema.safeParse({ workspaceId: UUID, signalId: UUID2 }).success).toBe(true);
    });

    it('parses valid proposal', () => {
      expect(arCollectionProposalSchema.safeParse({ actionType: 'send-reminder', confidence: 0.9, reasoning: 'Payment overdue' }).success).toBe(true);
    });
  });
});
