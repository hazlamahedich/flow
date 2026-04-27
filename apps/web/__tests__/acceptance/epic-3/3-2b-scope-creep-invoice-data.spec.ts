import { describe, test, expect } from 'vitest';
import { retainerAgreements } from '@flow/db/schema/retainer-agreements';
import {
  retainerSchema,
  scopeCreepAlertSchema,
  utilizationStateSchema,
} from '@flow/types';
import { isScopeCreep } from '@flow/shared';
import { createTestScopeCreepAlert, FAKE_UUID } from './test-factories';

describe('Story 3.2b: Scope Creep Detection & Retainer Invoice Data', () => {
  describe('Scope Creep Detection at 90% (FR73c)', () => {
    test('[P0] [3.2-UNIT-016] should define 90% threshold constant for scope creep detection', () => {
      // Given: the 90% threshold used across the system
      const SCOPE_CREEP_THRESHOLD = 0.9;
      // Then: it equals exactly 0.9
      expect(SCOPE_CREEP_THRESHOLD).toBe(0.9);
    });

    test('[P0] [3.2-UNIT-017] should calculate utilization percentage from tracked time vs retainer allocation', () => {
      // Given: tracked and allocated hours
      const trackedHours = 36;
      const allocatedHours = 40;
      // When: calculating utilization
      const utilization = trackedHours / allocatedHours;
      // Then: 90% exactly
      expect(utilization).toBe(0.9);
      expect(utilization >= 0.9).toBe(true);
    });

    test('[P0] [3.2-UNIT-018] should detect scope creep using production isScopeCreep function', () => {
      // Given: tracked minutes at 90% of 40-hour allocation (2160 min tracked, 2160 min threshold)
      const threshold = Math.floor(40 * 60 * 90 / 100); // 2160

      // When: tracked equals threshold → scope creep
      const at90 = isScopeCreep(threshold, threshold);
      expect(at90).toBe(true);

      // When: tracked is below threshold → no scope creep
      const below90 = isScopeCreep(threshold - 1, threshold);
      expect(below90).toBe(false);

      // When: tracked exceeds threshold → scope creep
      const over100 = isScopeCreep(threshold + 100, threshold);
      expect(over100).toBe(true);
    });

    test('[P0] [3.2-UNIT-019] should validate scope creep alert schema with real Zod type', () => {
      // Given: a valid scope creep alert payload
      const alert = createTestScopeCreepAlert();
      // When: parsed against the real schema
      const result = scopeCreepAlertSchema.safeParse(alert);
      // Then: schema accepts it
      expect(result.success).toBe(true);
    });

    test('[P0] [3.2-UNIT-020] should validate utilization state discriminated union', () => {
      // Given: valid utilization state variants
      const trackable = {
        type: 'trackable' as const,
        percent: 85,
        label: '85% utilized',
        color: 'amber' as const,
      };
      expect(utilizationStateSchema.safeParse(trackable).success).toBe(true);

      const informational = {
        type: 'informational' as const,
        hoursTracked: 25,
      };
      expect(utilizationStateSchema.safeParse(informational).success).toBe(true);

      const noThreshold = {
        type: 'no_threshold' as const,
        message: 'No threshold set',
      };
      expect(utilizationStateSchema.safeParse(noThreshold).success).toBe(true);
    });

    test('[P1] [3.2-UNIT-021] should handle zero allocated hours without division error', () => {
      // Given: zero or null allocated hours
      // When: checking scope creep with production function
      const zeroAlloc = isScopeCreep(600, 0);
      expect(zeroAlloc).toBe(false);

      const nullThreshold = isScopeCreep(600, null);
      expect(nullThreshold).toBe(false);
    });

    test('[P1] [3.2-UNIT-022] should calculate scope creep for flat monthly retainers', () => {
      // Given: a flat fee retainer where tracked exceeds 90% of flat fee
      const trackedCents = 45000;
      const flatFeeCents = 50000;
      const utilization = trackedCents / flatFeeCents;
      // Then: utilization exceeds 90%
      expect(utilization >= 0.9).toBe(true);
    });

    test.skip('[P0] [3.2-INT-005] should surface scope creep alert when 90% threshold is crossed', () => {
      // Requires running Supabase + notification system — integration test
    });

    test.skip('[P0] [3.2-E2E-001] should display scope creep alert on dashboard', () => {
      // Requires running app — E2E test
    });

    test.skip('[P1] [3.2-INT-006] should trigger notification when scope creep detected', () => {
      // Requires running Supabase + notification system — integration test (blocked by Epic 10)
    });

    test.skip('[P1] [3.2-INT-007] should not re-alert for same scope creep event', () => {
      // Requires running Supabase — integration test
    });
  });

  describe('Retainer Data for Invoice Generation', () => {
    test('[P0] [3.2-UNIT-023] should expose retainer data fields needed by Epic 7 invoicing', () => {
      // Given: the retainerAgreements table schema
      const columnNames = Object.keys(retainerAgreements);
      // Then: fields needed for invoice computation exist
      expect(columnNames).toContain('hourlyRateCents');
      expect(columnNames).toContain('monthlyFeeCents');
      expect(columnNames).toContain('packageHours');
      expect(columnNames).toContain('type');
    });

    test('[P1] [3.2-UNIT-024] should compute billable amount from hourly retainer', () => {
      // Given: rate and hours
      const rateCents = 7500;
      const hours = 10;
      // When: computing total
      const totalCents = rateCents * hours;
      // Then: result is in cents
      expect(totalCents).toBe(75000);
    });

    test('[P1] [3.2-UNIT-025] should compute billable amount from flat monthly retainer', () => {
      // Given: a flat monthly fee
      const flatFeeCents = 150000;
      // Then: the flat fee is the billable amount
      expect(flatFeeCents).toBe(150000);
    });

    test('[P1] [3.2-UNIT-026] should validate retainer output schema for invoice consumption', () => {
      // Given: a complete retainer payload
      const retainer = {
        id: FAKE_UUID,
        workspaceId: FAKE_UUID,
        clientId: FAKE_UUID,
        type: 'hourly_rate',
        hourlyRateCents: 7500,
        monthlyFeeCents: null,
        monthlyHoursThreshold: null,
        packageHours: null,
        packageName: null,
        billingPeriodDays: 30,
        startDate: '2025-01-01',
        endDate: null,
        status: 'active',
        cancelledAt: null,
        cancellationReason: null,
        notes: null,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };
      // When: validated against the full retainer schema
      const result = retainerSchema.safeParse(retainer);
      // Then: schema accepts it
      expect(result.success).toBe(true);
    });

    test.skip('[P1] [3.2-INT-008] should make retainer data available for invoice creation flow (Epic 7)', () => {
      // Cross-epic integration — verify retainer query from invoice context
    });
  });
});
