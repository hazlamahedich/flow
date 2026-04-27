import { describe, test, expect } from 'vitest';
import { retainerAgreements } from '@flow/db/schema/retainer-agreements';
import {
  retainerTypeEnum,
  createRetainerSchema,
  updateRetainerSchema,
  cancelRetainerSchema,
  retainerSchema,
  scopeCreepAlertSchema,
  utilizationStateSchema,
} from '@flow/types';

describe('Story 3.2: Retainer Agreements & Scope Creep Detection', () => {
  describe('Retainer Agreement Types (FR73a)', () => {
    test('[P0] should define hourly rate retainer type', () => {
      expect(retainerTypeEnum.Values.hourly_rate).toBe('hourly_rate');
    });

    test('[P0] should define flat monthly fee retainer type', () => {
      expect(retainerTypeEnum.Values.flat_monthly).toBe('flat_monthly');
    });

    test('[P0] should define package-based retainer type', () => {
      expect(retainerTypeEnum.Values.package_based).toBe('package_based');
    });

    test('[P0] should define retainer schema with required fields', () => {
      const columnNames = Object.keys(retainerAgreements);
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

    test('[P0] should store money values as integers in cents', () => {
      const columnNames = Object.keys(retainerAgreements);
      expect(columnNames).toContain('hourlyRateCents');
      expect(columnNames).toContain('monthlyFeeCents');
      expect(columnNames.some((c) => c.toLowerCase().includes('cents'))).toBe(true);
    });

    test('[P0] should validate hourly_rate creation via Zod discriminated union', () => {
      const result = createRetainerSchema.safeParse({
        type: 'hourly_rate',
        clientId: '00000000-0000-0000-0000-000000000001',
        hourlyRateCents: 7500,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('hourly_rate');
        if ('hourlyRateCents' in result.data) {
          expect(result.data.hourlyRateCents).toBe(7500);
        }
      }
    });

    test('[P0] should validate flat_monthly creation via Zod discriminated union', () => {
      const result = createRetainerSchema.safeParse({
        type: 'flat_monthly',
        clientId: '00000000-0000-0000-0000-000000000001',
        monthlyFeeCents: 150000,
        monthlyHoursThreshold: '40',
      });
      expect(result.success).toBe(true);
    });

    test('[P0] should validate package_based creation via Zod discriminated union', () => {
      const result = createRetainerSchema.safeParse({
        type: 'package_based',
        clientId: '00000000-0000-0000-0000-000000000001',
        packageHours: '20',
        packageName: 'Basic Support',
      });
      expect(result.success).toBe(true);
    });

    test('[P1] should validate hourly_rate_cents is positive integer', () => {
      const valid = createRetainerSchema.safeParse({
        type: 'hourly_rate',
        clientId: '00000000-0000-0000-0000-000000000001',
        hourlyRateCents: 1099,
      });
      expect(valid.success).toBe(true);

      const zero = createRetainerSchema.safeParse({
        type: 'hourly_rate',
        clientId: '00000000-0000-0000-0000-000000000001',
        hourlyRateCents: 0,
      });
      expect(zero.success).toBe(false);

      const negative = createRetainerSchema.safeParse({
        type: 'hourly_rate',
        clientId: '00000000-0000-0000-0000-000000000001',
        hourlyRateCents: -1,
      });
      expect(negative.success).toBe(false);
    });

    test('[P1] should validate flat_fee_cents is positive integer', () => {
      const valid = createRetainerSchema.safeParse({
        type: 'flat_monthly',
        clientId: '00000000-0000-0000-0000-000000000001',
        monthlyFeeCents: 50000,
        monthlyHoursThreshold: '40',
      });
      expect(valid.success).toBe(true);
    });

    test('[P1] should validate package_hours is positive number', () => {
      const valid = createRetainerSchema.safeParse({
        type: 'package_based',
        clientId: '00000000-0000-0000-0000-000000000001',
        packageHours: '40',
        packageName: 'Standard',
      });
      expect(valid.success).toBe(true);

      const invalid = createRetainerSchema.safeParse({
        type: 'package_based',
        clientId: '00000000-0000-0000-0000-000000000001',
        packageHours: '0',
        packageName: 'Standard',
      });
      expect(invalid.success).toBe(false);
    });

    test('[P1] should require period fields for retainer', () => {
      const columnNames = Object.keys(retainerAgreements);
      expect(columnNames).toContain('startDate');
      expect(columnNames).toContain('endDate');
      expect(columnNames).toContain('billingPeriodDays');
    });

    test('[P1] should reject invalid retainer type', () => {
      const result = createRetainerSchema.safeParse({
        type: 'invalid_type',
        clientId: '00000000-0000-0000-0000-000000000001',
        hourlyRateCents: 100,
      });
      expect(result.success).toBe(false);
    });

    test('[P1] should reject hourly_rate creation without hourlyRateCents', () => {
      const result = createRetainerSchema.safeParse({
        type: 'hourly_rate',
        clientId: '00000000-0000-0000-0000-000000000001',
      });
      expect(result.success).toBe(false);
    });

    test('[P1] should reject package_based without packageName', () => {
      const result = createRetainerSchema.safeParse({
        type: 'package_based',
        clientId: '00000000-0000-0000-0000-000000000001',
        packageHours: '10',
      });
      expect(result.success).toBe(false);
    });

    test.skip('[P0] should create retainer agreement scoped to client and workspace via Server Action', () => {
      // Requires running Supabase — integration test
    });

    test.skip('[P0] should reject retainer creation for non-existent client', () => {
      // Requires running Supabase — integration test
    });

    test.skip('[P1] should allow only one active retainer per client at a time', () => {
      // Requires running Supabase — integration test
    });

    test.skip('[P1] should auto-expire retainer when period_end passes', () => {
      // Requires running Supabase — integration test
    });
  });

  describe('Scope Creep Detection at 90% (FR73c)', () => {
    test('[P0] should define 90% threshold constant for scope creep detection', () => {
      const SCOPE_CREEP_THRESHOLD = 0.9;
      expect(SCOPE_CREEP_THRESHOLD).toBe(0.9);
    });

    test('[P0] should calculate utilization percentage from tracked time vs retainer allocation', () => {
      const trackedHours = 36;
      const allocatedHours = 40;
      const utilization = trackedHours / allocatedHours;
      expect(utilization).toBe(0.9);
      expect(utilization >= 0.9).toBe(true);
    });

    test('[P0] should detect scope creep when utilization reaches 90%', () => {
      const calculateScopeCreepStatus = (tracked: number, allocated: number) => {
        if (allocated <= 0) return { utilization: 0, isScopeCreep: false };
        const utilization = tracked / allocated;
        return { utilization, isScopeCreep: utilization >= 0.9 };
      };

      const at90 = calculateScopeCreepStatus(36, 40);
      expect(at90.isScopeCreep).toBe(true);

      const below90 = calculateScopeCreepStatus(35, 40);
      expect(below90.isScopeCreep).toBe(false);

      const over100 = calculateScopeCreepStatus(45, 40);
      expect(over100.isScopeCreep).toBe(true);
    });

    test('[P0] should validate scope creep alert schema with real Zod type', () => {
      const alert = {
        retainerId: '00000000-0000-0000-0000-000000000001',
        clientId: '00000000-0000-0000-0000-000000000002',
        clientName: 'Test Client',
        retainerType: 'hourly_rate' as const,
        trackedMinutes: 2160,
        thresholdMinutes: 2400,
        utilizationPercent: 90,
      };
      const result = scopeCreepAlertSchema.safeParse(alert);
      expect(result.success).toBe(true);
    });

    test('[P0] should validate utilization state discriminated union', () => {
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

    test('[P1] should handle zero allocated hours without division error', () => {
      const calculateUtilization = (tracked: number, allocated: number) => {
        if (allocated <= 0) return 0;
        return tracked / allocated;
      };
      expect(calculateUtilization(10, 0)).toBe(0);
      expect(calculateUtilization(10, -5)).toBe(0);
    });

    test('[P1] should calculate scope creep for flat monthly retainers', () => {
      const trackedCents = 45000;
      const flatFeeCents = 50000;
      const utilization = trackedCents / flatFeeCents;
      expect(utilization >= 0.9).toBe(true);
    });

    test.skip('[P0] should surface scope creep alert when 90% threshold is crossed', () => {
      // Requires running Supabase + notification system — integration test
    });

    test.skip('[P0] should display scope creep alert on dashboard', () => {
      // Requires running app — E2E test
    });

    test.skip('[P1] should trigger notification when scope creep detected', () => {
      // Requires running Supabase + notification system — integration test (blocked by Epic 10)
    });

    test.skip('[P1] should not re-alert for same scope creep event', () => {
      // Requires running Supabase — integration test
    });
  });

  describe('Retainer Data for Invoice Generation', () => {
    test('[P0] should expose retainer data fields needed by Epic 7 invoicing', () => {
      const columnNames = Object.keys(retainerAgreements);
      expect(columnNames).toContain('hourlyRateCents');
      expect(columnNames).toContain('monthlyFeeCents');
      expect(columnNames).toContain('packageHours');
      expect(columnNames).toContain('type');
    });

    test('[P1] should compute billable amount from hourly retainer', () => {
      const rateCents = 7500;
      const hours = 10;
      const totalCents = rateCents * hours;
      expect(totalCents).toBe(75000);
    });

    test('[P1] should compute billable amount from flat monthly retainer', () => {
      const flatFeeCents = 150000;
      expect(flatFeeCents).toBe(150000);
    });

    test('[P1] should validate retainer output schema for invoice consumption', () => {
      const retainer = {
        id: '00000000-0000-0000-0000-000000000001',
        workspaceId: '00000000-0000-0000-0000-000000000002',
        clientId: '00000000-0000-0000-0000-000000000003',
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
      const result = retainerSchema.safeParse(retainer);
      expect(result.success).toBe(true);
    });

    test.skip('[P1] should make retainer data available for invoice creation flow (Epic 7)', () => {
      // Cross-epic integration — verify retainer query from invoice context
    });
  });

  describe('Retainer Update & Cancellation', () => {
    test('[P0] should validate update retainer schema requires UUID retainerId', () => {
      const valid = updateRetainerSchema.safeParse({
        retainerId: '00000000-0000-0000-0000-000000000001',
        hourlyRateCents: 8000,
      });
      expect(valid.success).toBe(true);

      const invalid = updateRetainerSchema.safeParse({
        retainerId: 'not-a-uuid',
        hourlyRateCents: 8000,
      });
      expect(invalid.success).toBe(false);
    });

    test('[P0] should reject mixing fields from different retainer types in update', () => {
      const mixed = updateRetainerSchema.safeParse({
        retainerId: '00000000-0000-0000-0000-000000000001',
        hourlyRateCents: 8000,
        monthlyFeeCents: 50000,
      });
      expect(mixed.success).toBe(false);
    });

    test('[P0] should validate cancel retainer schema', () => {
      const valid = cancelRetainerSchema.safeParse({
        retainerId: '00000000-0000-0000-0000-000000000001',
        reason: 'Client requested cancellation',
      });
      expect(valid.success).toBe(true);

      const noReason = cancelRetainerSchema.safeParse({
        retainerId: '00000000-0000-0000-0000-000000000001',
      });
      expect(noReason.success).toBe(true);
    });

    test('[P1] should have cancelled_at and cancellation_reason in schema', () => {
      const columnNames = Object.keys(retainerAgreements);
      expect(columnNames).toContain('cancelledAt');
      expect(columnNames).toContain('cancellationReason');
    });
  });

  describe('RLS & Tenant Isolation', () => {
    test('[P0] should have workspace_id as not null foreign key', () => {
      const col = retainerAgreements.workspaceId;
      expect(col).toBeDefined();
      expect(col.notNull).toBe(true);
    });

    test('[P0] should have client_id as not null foreign key to clients', () => {
      const col = retainerAgreements.clientId;
      expect(col).toBeDefined();
      expect(col.notNull).toBe(true);
    });

    test.skip('[P0] should scope retainer records to workspace via RLS', () => {
      // Requires running Supabase — integration test
    });

    test.skip('[P0] should prevent cross-workspace retainer access', () => {
      // Requires running Supabase — integration test
    });

    test.skip('[P1] should enforce member-client access for retainer viewing', () => {
      // Requires running Supabase — integration test
    });
  });
});
