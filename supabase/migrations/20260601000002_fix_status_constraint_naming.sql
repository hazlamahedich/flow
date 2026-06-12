-- Migration: Rename misleading invoice status constraint (Epic 7 Retro TD2)
-- Purpose: The CHECK constraint `invoices_status_transition` is misnamed — it is a
-- status value whitelist, NOT a state transition guard. This migration renames
-- the constraint to accurately reflect its purpose and adds documentation.
--
-- Architecture Decision: Invoice status transitions (draft→sent→viewed→partially_paid→paid→overdue→voided)
-- are enforced at the application layer. The DB ensures only known statuses exist.
-- A true transition guard (trigger or CHECK that validates from→to per row) is deferred
-- to a future architecture spike if needed.
--
-- Related: docs/project-context.md#Constraints section on app-layer state machines.

-- ============================================
-- Step 1: Drop the misleadingly named constraint (if exists from 7.3 migration)
-- ============================================
ALTER TABLE invoices
  DROP CONSTRAINT IF EXISTS invoices_status_transition;

-- ============================================
-- Step 2: Add correctly named whitelist constraint (idempotent)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'invoices_status_valid' AND conrelid = 'invoices'::regclass
  ) THEN
    ALTER TABLE invoices
      ADD CONSTRAINT invoices_status_valid CHECK (
        status IN ('draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'voided')
      );
  END IF;
END $$;

-- ============================================
-- Step 3: Document app-layer enforcement in comments
-- ============================================
COMMENT ON CONSTRAINT invoices_status_valid ON invoices IS
  'Value whitelist only — status transitions (draft→sent→viewed→partially_paid→paid→overdue→voided) are enforced at the application layer. Terminal states: paid, voided.';
