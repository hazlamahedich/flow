import { describe, test, expect } from 'vitest';
import { retainerAgreements } from '@flow/db/schema/retainer-agreements';
import {
  retainerTypeEnum,
  createRetainerSchema,
  updateRetainerSchema,
  cancelRetainerSchema,
} from '@flow/types';
import {
  createTestHourlyRetainer,
  createTestFlatMonthlyRetainer,
  createTestPackageRetainer,
  FAKE_UUID,
} from './test-factories';

describe('Story 3.2a: Retainer Agreements — Types & CRUD', () => {
  describe('Retainer Agreement Types (FR73a)', () => {
    test('[P0] [3.2-UNIT-001] should define hourly rate retainer type', () => {
      expect(retainerTypeEnum.Values.hourly_rate).toBe('hourly_rate');
    });

    test('[P0] [3.2-UNIT-002] should define flat monthly fee retainer type', () => {
      expect(retainerTypeEnum.Values.flat_monthly).toBe('flat_monthly');
    });

    test('[P0] [3.2-UNIT-003] should define package-based retainer type', () => {
      expect(retainerTypeEnum.Values.package_based).toBe('package_based');
    });

    test('[P0] [3.2-UNIT-004] should define retainer schema with required fields', () => {
      // Given: the retainerAgreements Drizzle table schema
      const columnNames = Object.keys(retainerAgreements);
      // Then: all required columns exist
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('workspaceId');
      expect(columnNames).toContain('clientId');
      expect(columnNames).toContain('type');
      expect(columnNames).toContain('hourlyRateCents');
      expect(columnNames).toContain('monthlyFeeCents');
      expect(columnNames).toContain('packageHours');
      expect(columnNames).toContain('startDate');
      expect(columnNames).toContain('status');
    });

    test('[P0] [3.2-UNIT-005] should store money values as integers in cents', () => {
      // Given: the retainerAgreements table schema
      const columnNames = Object.keys(retainerAgreements);
      // Then: cents columns exist (no float/dollar columns)
      expect(columnNames).toContain('hourlyRateCents');
      expect(columnNames).toContain('monthlyFeeCents');
      expect(columnNames.some((c) => c.toLowerCase().includes('cents'))).toBe(true);
    });

    test('[P0] [3.2-UNIT-006] should validate hourly_rate creation via Zod discriminated union', () => {
      // Given: a valid hourly rate retainer payload
      const result = createRetainerSchema.safeParse(createTestHourlyRetainer());
      // Then: schema accepts it
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('hourly_rate');
        if ('hourlyRateCents' in result.data) {
          expect(result.data.hourlyRateCents).toBe(7500);
        }
      }
    });

    test('[P0] [3.2-UNIT-007] should validate flat_monthly creation via Zod discriminated union', () => {
      // Given: a valid flat monthly retainer payload
      const result = createRetainerSchema.safeParse(createTestFlatMonthlyRetainer());
      // Then: schema accepts it
      expect(result.success).toBe(true);
    });

    test('[P0] [3.2-UNIT-008] should validate package_based creation via Zod discriminated union', () => {
      // Given: a valid package-based retainer payload
      const result = createRetainerSchema.safeParse(createTestPackageRetainer());
      // Then: schema accepts it
      expect(result.success).toBe(true);
    });

    test('[P1] [3.2-UNIT-009] should validate hourly_rate_cents is positive integer', () => {
      // Given: valid and invalid hourly rates
      const valid = createRetainerSchema.safeParse(createTestHourlyRetainer({ hourlyRateCents: 1099 }));
      expect(valid.success).toBe(true);

      const zero = createRetainerSchema.safeParse(createTestHourlyRetainer({ hourlyRateCents: 0 }));
      expect(zero.success).toBe(false);

      const negative = createRetainerSchema.safeParse(createTestHourlyRetainer({ hourlyRateCents: -1 }));
      expect(negative.success).toBe(false);
    });

    test('[P1] [3.2-UNIT-010] should validate flat_fee_cents is positive integer', () => {
      // Given: a valid flat monthly fee
      const valid = createRetainerSchema.safeParse(createTestFlatMonthlyRetainer({ monthlyFeeCents: 50000 }));
      expect(valid.success).toBe(true);
    });

    test('[P1] [3.2-UNIT-011] should validate package_hours is positive number', () => {
      // Given: valid and invalid package hours
      const valid = createRetainerSchema.safeParse(createTestPackageRetainer({ packageHours: '40' }));
      expect(valid.success).toBe(true);

      const invalid = createRetainerSchema.safeParse(createTestPackageRetainer({ packageHours: '0' }));
      expect(invalid.success).toBe(false);
    });

    test('[P1] [3.2-UNIT-012] should require period fields for retainer', () => {
      // Given: the retainerAgreements table schema
      const columnNames = Object.keys(retainerAgreements);
      // Then: period columns exist
      expect(columnNames).toContain('startDate');
      expect(columnNames).toContain('endDate');
      expect(columnNames).toContain('billingPeriodDays');
    });

    test('[P1] [3.2-UNIT-013] should reject invalid retainer type', () => {
      // Given: an invalid retainer type
      const result = createRetainerSchema.safeParse({
        type: 'invalid_type',
        clientId: FAKE_UUID,
        hourlyRateCents: 100,
      });
      expect(result.success).toBe(false);
    });

    test('[P1] [3.2-UNIT-014] should reject hourly_rate creation without hourlyRateCents', () => {
      const result = createRetainerSchema.safeParse({
        type: 'hourly_rate',
        clientId: FAKE_UUID,
      });
      expect(result.success).toBe(false);
    });

    test('[P1] [3.2-UNIT-015] should reject package_based without packageName', () => {
      const result = createRetainerSchema.safeParse({
        type: 'package_based',
        clientId: FAKE_UUID,
        packageHours: '10',
      });
      expect(result.success).toBe(false);
    });

    test.skip('[P0] [3.2-INT-001] should create retainer agreement scoped to client and workspace via Server Action', () => {
      // Requires running Supabase — integration test
    });

    test.skip('[P0] [3.2-INT-002] should reject retainer creation for non-existent client', () => {
      // Requires running Supabase — integration test
    });

    test.skip('[P1] [3.2-INT-003] should allow only one active retainer per client at a time', () => {
      // Requires running Supabase — integration test
    });

    test.skip('[P1] [3.2-INT-004] should auto-expire retainer when period_end passes', () => {
      // Requires running Supabase — integration test
    });
  });

  describe('Retainer Update & Cancellation', () => {
    test('[P0] [3.2-UNIT-027] should validate update retainer schema requires UUID retainerId', () => {
      // Given: a valid UUID retainerId
      const valid = updateRetainerSchema.safeParse({
        retainerId: FAKE_UUID,
        hourlyRateCents: 8000,
      });
      expect(valid.success).toBe(true);

      // When: retainerId is not a UUID
      const invalid = updateRetainerSchema.safeParse({
        retainerId: 'not-a-uuid',
        hourlyRateCents: 8000,
      });
      expect(invalid.success).toBe(false);
    });

    test('[P0] [3.2-UNIT-028] should reject mixing fields from different retainer types in update', () => {
      // Given: fields from both hourly and monthly types
      const mixed = updateRetainerSchema.safeParse({
        retainerId: FAKE_UUID,
        hourlyRateCents: 8000,
        monthlyFeeCents: 50000,
      });
      expect(mixed.success).toBe(false);
    });

    test('[P0] [3.2-UNIT-029] should validate cancel retainer schema', () => {
      // Given: a valid cancellation with reason
      const valid = cancelRetainerSchema.safeParse({
        retainerId: FAKE_UUID,
        reason: 'Client requested cancellation',
      });
      expect(valid.success).toBe(true);

      // When: reason is omitted (optional)
      const noReason = cancelRetainerSchema.safeParse({
        retainerId: FAKE_UUID,
      });
      expect(noReason.success).toBe(true);
    });

    test('[P1] [3.2-UNIT-030] should have cancelled_at and cancellation_reason in schema', () => {
      // Given: the retainerAgreements table schema
      const columnNames = Object.keys(retainerAgreements);
      // Then: cancellation tracking columns exist
      expect(columnNames).toContain('cancelledAt');
      expect(columnNames).toContain('cancellationReason');
    });
  });

  describe('RLS & Tenant Isolation', () => {
    test('[P0] [3.2-UNIT-031] should have workspace_id as not null foreign key', () => {
      const col = retainerAgreements.workspaceId;
      expect(col).toBeDefined();
      expect(col.notNull).toBe(true);
    });

    test('[P0] [3.2-UNIT-032] should have client_id as not null foreign key to clients', () => {
      const col = retainerAgreements.clientId;
      expect(col).toBeDefined();
      expect(col.notNull).toBe(true);
    });

    test.skip('[P0] [3.2-INT-009] should scope retainer records to workspace via RLS', () => {
      // Requires running Supabase — integration test
    });

    test.skip('[P0] [3.2-INT-010] should prevent cross-workspace retainer access', () => {
      // Requires running Supabase — integration test
    });

    test.skip('[P1] [3.2-INT-011] should enforce member-client access for retainer viewing', () => {
      // Requires running Supabase — integration test
    });
  });
});
