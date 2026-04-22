-- Migration: Add version column for optimistic locking
-- Story: 1.9 Undo & Conflict Resolution
-- Note: This migration adds version columns to entity tables.
-- The clients and invoices tables will be created in Epic 3 and Epic 7.
-- This migration should run AFTER those table creation migrations.

-- When clients table exists (Epic 3), add version column:
-- ALTER TABLE clients ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
-- ALTER TABLE clients ADD CONSTRAINT clients_version_positive CHECK (version > 0);
-- CREATE INDEX IF NOT EXISTS idx_clients_version ON clients(id, version);

-- When invoices table exists (Epic 7), add version column:
-- ALTER TABLE invoices ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
-- ALTER TABLE invoices ADD CONSTRAINT invoices_version_positive CHECK (version > 0);
-- CREATE INDEX IF NOT EXISTS idx_invoices_version ON invoices(id, version);

-- Placeholder: This migration is intentionally empty.
-- The version columns will be included in the initial table definitions
-- when clients (Epic 3) and invoices (Epic 7) tables are created.
-- The commented-out ALTER TABLE statements above serve as documentation
-- for the required schema additions.

-- Alternative: Include `version integer NOT NULL DEFAULT 1` directly in
-- the CREATE TABLE statements for clients and invoices when those
-- migrations are written in their respective epics.
