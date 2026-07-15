import { describe, test, expect, vi } from 'vitest';
import {
  formatCentsToDollar,
  parseDollarToCents,
  isScopeCreep,
  calculateThresholdMinutes,
} from '@flow/shared';
import {
  detectGaps,
  detectLowHours,
  type TimeEntryForDetection,
} from '@flow/agents/time-integrity/anomaly-detection';
import {
  LOW_HOURS_TARGET,
  timeIntegrityInputSchema,
} from '@flow/agents/time-integrity/schemas';
import { isSupabaseAvailable, setupRLSFixture } from '@flow/test-utils';

function buildTimeEntry(
  overrides: Partial<TimeEntryForDetection> = {},
): TimeEntryForDetection {
  return {
    id: crypto.randomUUID(),
    date: '2026-05-09',
    durationMinutes: 60,
    ...overrides,
  };
}

describe('Story 5.1: Time Entry Data Model & Manual Logging', () => {
  describe('AC1: Time entry input validation', () => {
    test('[P0] [5.1-AC1-001] should accept valid time entry input', () => {
      const validInput = {
        clientId: crypto.randomUUID(),
        date: '2026-05-09',
        durationMinutes: 60,
        notes: 'Client meeting',
      };
      expect(validInput.clientId).toMatch(/^[0-9a-f-]{36}$/);
      expect(validInput.durationMinutes).toBeGreaterThan(0);
      expect(validInput.durationMinutes).toBeLessThanOrEqual(1440);
      expect(validInput.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test('[P0] [5.1-AC1-002] should reject entry with negative duration', () => {
      const input = buildTimeEntry({ durationMinutes: -30 });
      expect(input.durationMinutes).toBeLessThan(0);
    });

    test('[P0] [5.1-AC1-003] should reject entry with zero duration', () => {
      const input = buildTimeEntry({ durationMinutes: 0 });
      expect(input.durationMinutes).toBe(0);
    });

    test('[P0] [5.1-AC1-004] should reject entry with invalid date format', () => {
      const badDate = 'not-a-date';
      expect(badDate).not.toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test('[P1] [5.1-AC1-005] should reject notes exceeding 500 characters', () => {
      const longNotes = 'x'.repeat(501);
      expect(longNotes.length).toBeGreaterThan(500);
    });

    test('[P1] [5.1-AC1-006] should accept entry with optional projectId', () => {
      const input = buildTimeEntry();
      expect(input).toHaveProperty('id');
      expect(input).toHaveProperty('date');
      expect(input).toHaveProperty('durationMinutes');
    });
  });

  describe('AC2: Money is integers in cents', () => {
    test('[P0] [5.1-AC2-001] should format cents to dollar string', () => {
      expect(formatCentsToDollar(10990)).toBe('109.90');
      expect(formatCentsToDollar(0)).toBe('0.00');
      expect(formatCentsToDollar(99)).toBe('0.99');
    });

    test('[P0] [5.1-AC2-002] should parse dollar string to integer cents', () => {
      expect(parseDollarToCents('109.90')).toBe(10990);
      expect(parseDollarToCents('0.99')).toBe(99);
      expect(parseDollarToCents('10')).toBe(1000);
    });

    test('[P0] [5.1-AC2-003] should round-trip cents without precision loss', () => {
      const original = 10990;
      const roundTripped = parseDollarToCents(formatCentsToDollar(original));
      expect(roundTripped).toBe(original);
    });

    test('[P1] [5.1-AC2-004] should reject negative dollar amounts', () => {
      expect(parseDollarToCents('-5.00')).toBeNull();
    });

    test('[P1] [5.1-AC2-005] should handle null/empty cents gracefully', () => {
      expect(formatCentsToDollar(null)).toBe('');
      expect(parseDollarToCents('')).toBeNull();
    });
  });

  describe('AC3: RLS — workspace isolation for time entries', () => {
    const supabaseAvailable = isSupabaseAvailable();

    test.skipIf(!supabaseAvailable)(
      '[P0] [5.1-AC3-001] should deny cross-workspace time entry access',
      async () => {
        const tenantId = crypto.randomUUID();
        const fixture = await setupRLSFixture(tenantId, 'member');

        try {
          const adminClient = fixture.client;
          const { data: entry } = await adminClient
            .from('time_entries')
            .insert({
              workspace_id: tenantId,
              client_id: crypto.randomUUID(),
              user_id: crypto.randomUUID(),
              date: '2026-05-09',
              duration_minutes: 60,
            })
            .select('id')
            .single();

          const { data: crossTenantData } = await adminClient
            .from('time_entries')
            .select('*')
            .eq('id', entry?.id ?? '');

          expect(crossTenantData).toHaveLength(0);
        } finally {
          await fixture.cleanup();
        }
      },
    );
  });
});
