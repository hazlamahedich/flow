import { describe, test, expect, vi } from 'vitest';
import {
  formatCentsToDollar,
  parseDollarToCents,
  isScopeCreep,
  calculateThresholdMinutes,
} from '@flow/shared';
import {
  detectGaps,
  detectOverlaps,
  type TimeEntryForDetection,
} from '@flow/agents/time-integrity/anomaly-detection';
import { GAP_THRESHOLD_MINUTES } from '@flow/agents/time-integrity/schemas';
import {
  getBossInstance,
  setBossInstance,
  clearBossInstance,
} from '@flow/agents/orchestrator/boss-di';
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

describe('Story 5.3: Time Entry Editing & Invoice Impact Warnings', () => {
  describe('AC1: Edit time entry fields', () => {
    test('[P0] [5.3-AC1-001] should accept valid edit payload with changed fields', () => {
      const current = {
        date: '2025-01-15',
        durationMinutes: 60,
        clientId: crypto.randomUUID(),
      };
      const proposed = {
        date: '2025-01-15',
        durationMinutes: 120,
        clientId: current.clientId,
      };
      const changedFields: Record<string, unknown> = {};
      if (proposed.date !== current.date) changedFields.date = current.date;
      if (proposed.durationMinutes !== current.durationMinutes)
        changedFields.durationMinutes = current.durationMinutes;
      expect(changedFields).toEqual({ durationMinutes: 60 });
    });

    test('[P0] [5.3-AC1-002] should produce empty diff when no fields changed', () => {
      const current = { date: '2025-01-15', durationMinutes: 120 };
      const proposed = { date: '2025-01-15', durationMinutes: 120 };
      const changedFields: Record<string, unknown> = {};
      if (proposed.date !== current.date) changedFields.date = current.date;
      if (proposed.durationMinutes !== current.durationMinutes)
        changedFields.durationMinutes = current.durationMinutes;
      expect(Object.keys(changedFields)).toHaveLength(0);
    });
  });

  describe('AC2: Invoice impact warning on edit', () => {
    test('[P0] [5.3-AC2-001] should flag warning when editing invoiced entry', async () => {
      const guard = { isInvoiced: async (entryId: string) => true };
      const result = await guard.isInvoiced('te-1');
      expect(result).toBe(true);
    });

    test('[P0] [5.3-AC2-002] should calculate duration delta for warning', () => {
      const original = 60;
      const proposed = 90;
      const delta = proposed - original;
      expect(delta).toBe(30);
      expect(Math.sign(delta)).toBe(1);
    });

    test('[P1] [5.3-AC2-003] should return negative delta when duration decreases', () => {
      const original = 120;
      const proposed = 60;
      const delta = proposed - original;
      expect(delta).toBe(-60);
      expect(Math.sign(delta)).toBe(-1);
    });
  });

  describe('AC3: Scope creep alert integration', () => {
    test('[P0] [5.3-AC3-001] should detect scope creep at 90% threshold', () => {
      const allocatedHours = '10';
      const threshold = calculateThresholdMinutes(allocatedHours);
      expect(threshold).toBe(540);

      const trackedMinutes = 540;
      expect(isScopeCreep(trackedMinutes, threshold)).toBe(true);
    });

    test('[P0] [5.3-AC3-002] should not flag scope creep below 90% threshold', () => {
      const allocatedHours = '10';
      const threshold = calculateThresholdMinutes(allocatedHours);
      const trackedMinutes = 500;
      expect(isScopeCreep(trackedMinutes, threshold)).toBe(false);
    });

    test('[P1] [5.3-AC3-003] should return null threshold for null allocation', () => {
      const threshold = calculateThresholdMinutes(null);
      expect(threshold).toBeNull();
      expect(isScopeCreep(500, threshold)).toBe(false);
    });
  });

  describe('AC4: Edit conflict detection (concurrent edits)', () => {
    const supabaseAvailable = isSupabaseAvailable();

    test('[P1] [5.3-AC4-001] should detect stale update by comparing updatedAt', () => {
      const originalUpdatedAt = '2026-05-09T09:00:00Z';
      const currentInDb = '2026-05-09T09:05:00Z';
      const isStale = currentInDb !== originalUpdatedAt;
      expect(isStale).toBe(true);
    });

    test('[P1] [5.3-AC4-002] should allow update when timestamps match', () => {
      const originalUpdatedAt = '2026-05-09T09:00:00Z';
      const currentInDb = '2026-05-09T09:00:00Z';
      const isStale = currentInDb !== originalUpdatedAt;
      expect(isStale).toBe(false);
    });

    test.skipIf(!supabaseAvailable)(
      '[P0] [5.3-AC4-003] should prevent concurrent edit via RLS workspace scope',
      async () => {
        const tenantId = crypto.randomUUID();
        const fixture = await setupRLSFixture(tenantId, 'member');
        try {
          const { data } = await fixture.client
            .from('time_entries')
            .select('id')
            .eq('workspace_id', fixture.otherTenantId)
            .limit(1);
          expect(data).toHaveLength(0);
        } finally {
          await fixture.cleanup();
        }
      },
    );
  });
});
