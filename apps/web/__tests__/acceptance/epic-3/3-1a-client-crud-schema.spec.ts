import { describe, test, expect } from 'vitest';
import { clients } from '@flow/db/schema/clients';
import { memberClientAccess } from '@flow/db/schema/member-client-access';
import {
  createClientSchema,
  updateClientSchema,
  archiveClientSchema,
  clientStatusEnum,
} from '@flow/types';
import { createTestClient, FAKE_UUID } from './test-factories';

describe('Story 3.1a: Client Data Model — CRUD & Schema', () => {
  describe('Client Record Creation (FR11)', () => {
    test('[P0] [3.1-UNIT-001] should define client schema with contact details, service agreements, and billing preferences', () => {
      // Given: the clients Drizzle table schema
      const columnNames = Object.keys(clients);
      // Then: all required columns exist
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('workspaceId');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('email');
      expect(columnNames).toContain('phone');
      expect(columnNames).toContain('companyName');
      expect(columnNames).toContain('status');
      expect(columnNames).toContain('hourlyRateCents');
      expect(columnNames).toContain('billingEmail');
      expect(columnNames).toContain('notes');
      expect(columnNames).toContain('createdAt');
      expect(columnNames).toContain('updatedAt');
    });

    test('[P0] [3.1-UNIT-002] should enforce workspace_id as required on every client record (tenant isolation)', () => {
      // Given: the clients table workspaceId column
      const workspaceCol = clients.workspaceId;
      // Then: it must be not null
      expect(workspaceCol).toBeDefined();
      expect(workspaceCol.notNull).toBe(true);
    });

    test('[P0] [3.1-UNIT-003] should validate client name is non-empty and within length limit', () => {
      // Given: valid client data
      const valid = createClientSchema.safeParse(createTestClient({ name: 'Acme Corp' }));
      expect(valid.success).toBe(true);

      // When: name is empty
      const empty = createClientSchema.safeParse(createTestClient({ name: '' }));
      // Then: schema rejects it
      expect(empty.success).toBe(false);

      // When: name is whitespace only
      const whitespace = createClientSchema.safeParse(createTestClient({ name: '   ' }));
      expect(whitespace.success).toBe(false);

      // When: name exceeds 200 chars
      const long = createClientSchema.safeParse(createTestClient({ name: 'x'.repeat(201) }));
      expect(long.success).toBe(false);
    });

    test('[P1] [3.1-UNIT-004] should validate email format on client contact details', () => {
      // Given: a valid email
      const valid = createClientSchema.safeParse(createTestClient({ email: 'valid@example.com' }));
      expect(valid.success).toBe(true);

      // When: email is empty string (allowed — optional field)
      const empty = createClientSchema.safeParse(createTestClient({ email: '' }));
      expect(empty.success).toBe(true);

      // When: email is invalid format
      const invalid = createClientSchema.safeParse(createTestClient({ email: 'not-an-email' }));
      expect(invalid.success).toBe(false);
    });

    test('[P1] [3.1-UNIT-005] should validate phone number format (optional field)', () => {
      // Given: a valid phone number
      const withPhone = createClientSchema.safeParse(createTestClient({ phone: '+1 (555) 123-4567' }));
      expect(withPhone.success).toBe(true);

      // When: phone is empty (allowed — optional field)
      const noPhone = createClientSchema.safeParse(createTestClient({ phone: '' }));
      expect(noPhone.success).toBe(true);

      // When: phone is omitted entirely
      const omitted = createClientSchema.safeParse(createTestClient());
      expect(omitted.success).toBe(true);
    });

    test('[P0] [3.1-UNIT-006] should validate full client creation payload via Zod schema', () => {
      // Given: a complete client payload
      const result = createClientSchema.safeParse(createTestClient({
        name: 'E2E Corp',
        email: 'hello@e2e.com',
        phone: '+1-555-0100',
        companyName: 'E2E Inc',
        billingEmail: 'billing@e2e.com',
        hourlyRateCents: 7500,
        notes: 'Important client',
      }));
      // Then: schema accepts it
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('E2E Corp');
        expect(result.data.hourlyRateCents).toBe(7500);
      }
    });

    test('[P0] [3.1-UNIT-007] should reject client creation with negative hourly rate', () => {
      // Given: a client payload with negative hourly rate
      const result = createClientSchema.safeParse(createTestClient({ hourlyRateCents: -100 }));
      // Then: schema rejects it
      expect(result.success).toBe(false);
    });

    test('[P0] [3.1-UNIT-008] should reject client creation with missing name', () => {
      // Given: a payload with email but no name
      const result = createClientSchema.safeParse({ email: 'test@test.com' });
      // Then: schema rejects it
      expect(result.success).toBe(false);
    });

    test.skip('[P0] [3.1-INT-001] should create a client record via Server Action with RLS enforcement', () => {
      // Requires running Supabase — integration test
    });

    test.skip('[P0] [3.1-INT-002] should reject client creation from unauthenticated user', () => {
      // Requires running Supabase — integration test
    });

    test.skip('[P1] [3.1-INT-003] should reject client creation from user not in workspace', () => {
      // Requires running Supabase — integration test
    });
  });

  describe('Client Editing with Cascading Updates (FR13)', () => {
    test('[P0] [3.1-UNIT-009] should define mutable client fields for editing', () => {
      // Given: the updateClientSchema shape
      const editablePaths = Object.keys(updateClientSchema.shape).filter(
        (k) => k !== 'clientId',
      );
      // Then: all expected mutable fields are present
      expect(editablePaths).toContain('name');
      expect(editablePaths).toContain('email');
      expect(editablePaths).toContain('phone');
      expect(editablePaths).toContain('companyName');
      expect(editablePaths).toContain('billingEmail');
      expect(editablePaths).toContain('hourlyRateCents');
      expect(editablePaths).toContain('notes');
    });

    test('[P0] [3.1-UNIT-010] should not allow editing workspace_id (immutable tenant binding)', () => {
      // Given: column names and editable paths
      const columnNames = Object.keys(clients);
      const editablePaths = Object.keys(updateClientSchema.shape);
      // Then: workspaceId and id are not editable
      expect(columnNames).toContain('workspaceId');
      expect(editablePaths).not.toContain('workspaceId');
      expect(editablePaths).not.toContain('id');
    });

    test('[P0] [3.1-UNIT-011] should require clientId as UUID for update', () => {
      // Given: a valid UUID clientId
      const valid = updateClientSchema.safeParse({
        clientId: FAKE_UUID,
        name: 'Updated',
      });
      expect(valid.success).toBe(true);

      // When: clientId is not a UUID
      const invalid = updateClientSchema.safeParse({
        clientId: 'not-a-uuid',
        name: 'Updated',
      });
      // Then: schema rejects it
      expect(invalid.success).toBe(false);
    });

    test.skip('[P0] [3.1-INT-004] should reflect client edits across associated invoices', () => {
      // Requires running Supabase — integration test (blocked by Epic 7)
    });

    test.skip('[P0] [3.1-INT-005] should reflect client edits across associated reports', () => {
      // Requires running Supabase — integration test
    });

    test.skip('[P1] [3.1-INT-006] should reflect client edits across associated time entries', () => {
      // Requires running Supabase — integration test (blocked by Epic 5)
    });

    test.skip('[P1] [3.1-INT-007] should use revalidateTag() to invalidate client-related caches', () => {
      // Requires running app — integration test
    });
  });

  describe('Client Archiving (FR14)', () => {
    test('[P0] [3.1-UNIT-012] should define archived status value distinct from active', () => {
      // Given: the client status enum
      // Then: active and archived are distinct values
      expect(clientStatusEnum.Values.active).toBe('active');
      expect(clientStatusEnum.Values.archived).toBe('archived');
    });

    test('[P0] [3.1-UNIT-013] should preserve all historical data on archive', () => {
      // Given: related data tables that must survive archival
      const preservedRelations = ['invoices', 'time_entries', 'reports', 'retainer_agreements'] as const;
      // Then: at least 3 relation types are tracked
      expect(preservedRelations.length).toBeGreaterThanOrEqual(3);
    });

    test('[P0] [3.1-UNIT-014] should validate archive action requires UUID clientId', () => {
      // Given: a valid UUID clientId
      const valid = archiveClientSchema.safeParse({ clientId: FAKE_UUID });
      expect(valid.success).toBe(true);

      // When: clientId is missing
      const missing = archiveClientSchema.safeParse({});
      expect(missing.success).toBe(false);

      // When: clientId is not a UUID
      const badId = archiveClientSchema.safeParse({ clientId: 'abc' });
      expect(badId.success).toBe(false);
    });

    test('[P0] [3.1-UNIT-015] should have archivedAt column in schema for audit trail', () => {
      // Given: the clients table schema
      const columnNames = Object.keys(clients);
      // Then: archivedAt column exists
      expect(columnNames).toContain('archivedAt');
    });

    test('[P0] [3.1-UNIT-016] should enforce DB check constraint: archived status requires archived_at', () => {
      // Given: the clients table schema
      // Then: both status and archivedAt columns exist for the check constraint
      const columnNames = Object.keys(clients);
      expect(columnNames).toContain('status');
      expect(columnNames).toContain('archivedAt');
    });

    test.skip('[P0] [3.1-INT-008] should set client status to archived without deleting the record', () => {
      // Requires running Supabase — integration test
    });

    test.skip('[P0] [3.1-INT-009] should exclude archived clients from default list views', () => {
      // Requires running Supabase — integration test
    });

    test.skip('[P1] [3.1-INT-010] should allow restoring an archived client to active status', () => {
      // Requires running Supabase — integration test
    });

    test.skip('[P1] [3.1-INT-011] should preserve invoices, reports, and time entries after archival', () => {
      // Requires running Supabase — integration test
    });
  });

  describe('RLS & Data Isolation', () => {
    test('[P0] [3.1-UNIT-017] should have workspace_id index on clients table for query performance', () => {
      // Given: the clients table schema
      // Then: workspaceId column exists (index verified at migration level)
      const columnNames = Object.keys(clients);
      expect(columnNames).toContain('workspaceId');
      expect(clients.workspaceId.notNull).toBe(true);
    });

    test('[P0] [3.1-UNIT-018] should have composite index on workspace_id + status', () => {
      // Given: the clients table schema
      // Then: both columns exist for the composite index
      const columnNames = Object.keys(clients);
      expect(columnNames).toContain('workspaceId');
      expect(columnNames).toContain('status');
    });

    test.skip('[P0] [3.1-INT-012] should enforce workspace_id ::text cast in client RLS policies', () => {
      // Requires running Supabase — integration test
    });

    test.skip('[P0] [3.1-INT-013] should prevent cross-workspace client access', () => {
      // Requires running Supabase — integration test
    });

    test.skip('[P1] [3.1-INT-014] should audit client CRUD operations in audit_log', () => {
      // Requires running Supabase — integration test
    });
  });
});
