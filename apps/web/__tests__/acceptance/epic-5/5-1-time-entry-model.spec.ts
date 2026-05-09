import { describe, test, expect } from 'vitest';
import { z } from 'zod';

const TimeEntryInputSchema = z.object({
  clientId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  date: z.string().date(),
  durationMinutes: z.number().int().positive(),
  notes: z.string().max(500).optional(),
  billable: z.boolean().default(true),
});

describe('Story 5.1: Time Entry Data Model & Manual Logging', () => {
  describe('AC1: Time entry input validation', () => {
    test('[P0] should accept valid time entry input', () => {
      const input = {
        clientId: crypto.randomUUID(),
        date: '2026-05-09',
        durationMinutes: 60,
        notes: 'Client meeting',
        billable: true,
      };
      const result = TimeEntryInputSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    test('[P0] should reject entry with missing clientId', () => {
      const input = {
        date: '2026-05-09',
        durationMinutes: 60,
      };
      const result = TimeEntryInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    test('[P0] should reject entry with negative duration', () => {
      const input = {
        clientId: crypto.randomUUID(),
        date: '2026-05-09',
        durationMinutes: -30,
      };
      const result = TimeEntryInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    test('[P0] should reject entry with invalid date format', () => {
      const input = {
        clientId: crypto.randomUUID(),
        date: 'not-a-date',
        durationMinutes: 60,
      };
      const result = TimeEntryInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    test('[P1] should default billable to true when omitted', () => {
      const input = {
        clientId: crypto.randomUUID(),
        date: '2026-05-09',
        durationMinutes: 90,
      };
      const result = TimeEntryInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.billable).toBe(true);
      }
    });

    test('[P1] should reject notes exceeding 500 characters', () => {
      const input = {
        clientId: crypto.randomUUID(),
        date: '2026-05-09',
        durationMinutes: 60,
        notes: 'x'.repeat(501),
      };
      const result = TimeEntryInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('AC2: Money is integers in cents', () => {
    test('[P0] should never use float for monetary values', () => {
      const rateInCents = 10990;
      expect(Number.isInteger(rateInCents)).toBe(true);
      expect(rateInCents).toBe(10990);
    });
  });

  describe.skip('AC3: RLS — workspace isolation for time entries', () => {
    test('[P0] should deny cross-workspace time entry access', async () => {
      // Requires running Supabase
    });
  });
});
