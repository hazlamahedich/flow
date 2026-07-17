-- Migration: workspace_members suspended state (Story 9.5c AC6 — FR57a)
-- Purpose: Add the `suspended` membership status for Agency→Pro downgrade.
--          Three changes:
--            (1) WIDEN the status CHECK to include 'suspended'.
--            (2) Add `suspended_at` and `suspension_reason` columns.
--            (3) Add a status/suspended_at consistency CHECK.
--
-- CORRECTION TO STORY: the original 9-5c AC6 claimed workspace_members.status
-- was "bare text, no CHECK" requiring "zero schema lines." This was wrong —
-- migration 20260421170001:27 added CHECK (status IN ('active','expired','revoked')).
-- This migration widens that CHECK (required for the suspend writes to succeed).
--
-- Templated on:
--   - clients.status / archived_at pattern (20260504000001_enhance_clients_for_crud.sql)
--   - clients_status_archived_at_check (consistency CHECK)
--
-- The latent RLS bug fix (status='active' in the UPDATE policy) is a SEPARATE
-- sibling migration (20260717000002_workspace_members_suspended_rls.sql) to
-- mirror the 9-5b split (schema vs RLS).
--
-- Idempotent: uses IF NOT EXISTS for columns; DROP + RECREATE for the CHECK.
-- Related: 9-5c-agency-to-pro-downgrade.md AC6.

-- ═══════════════════════════════════════════════════════════════════════
-- (1) Widen the status CHECK to include 'suspended'
-- ═══════════════════════════════════════════════════════════════════════
-- The auto-generated constraint name is <table>_<column>_check, i.e.
-- `workspace_members_status_check`. Drop and recreate with the wider enum.
ALTER TABLE workspace_members DROP CONSTRAINT IF EXISTS workspace_members_status_check;

ALTER TABLE workspace_members ADD CONSTRAINT workspace_members_status_check
  CHECK (status IN ('active', 'expired', 'revoked', 'suspended'));

-- ═══════════════════════════════════════════════════════════════════════
-- (2) Add suspended_at and suspension_reason columns
-- ═══════════════════════════════════════════════════════════════════════
-- Mirrors clients.archived_at (20260504000001). NULL when status != 'suspended';
-- set to now() when the webhook suspends the member. `suspension_reason` is
-- bare text (machine-readable categorization for audit/analytics), NOT user-
-- facing copy — user-facing copy lives in the notification templates (AC5).
ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS suspended_at timestamptz;
ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS suspension_reason text;

-- ═══════════════════════════════════════════════════════════════════════
-- (3) status / suspended_at consistency CHECK
-- ═══════════════════════════════════════════════════════════════════════
-- Templated on clients_status_archived_at_check: a row is suspended iff
-- suspended_at is set. Prevents the two columns from drifting out of sync
-- (e.g. status='active' but suspended_at set, which would be ambiguous).
ALTER TABLE workspace_members DROP CONSTRAINT IF EXISTS workspace_members_status_suspended_at_check;

ALTER TABLE workspace_members ADD CONSTRAINT workspace_members_status_suspended_at_check
  CHECK (
    (status = 'suspended' AND suspended_at IS NOT NULL)
    OR
    (status != 'suspended' AND suspended_at IS NULL)
  );

-- ═══════════════════════════════════════════════════════════════════════
-- Verify (run on `supabase db reset` / psql apply):
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--     WHERE conname = 'workspace_members_status_check';
-- ═══════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════
-- Down SQL (apply to revert):
--   ALTER TABLE workspace_members DROP CONSTRAINT IF EXISTS workspace_members_status_suspended_at_check;
--   ALTER TABLE workspace_members DROP COLUMN IF EXISTS suspension_reason;
--   ALTER TABLE workspace_members DROP COLUMN IF EXISTS suspended_at;
--   ALTER TABLE workspace_members DROP CONSTRAINT IF EXISTS workspace_members_status_check;
--   ALTER TABLE workspace_members ADD CONSTRAINT workspace_members_status_check
--     CHECK (status IN ('active', 'expired', 'revoked'));
-- ═══════════════════════════════════════════════════════════════════════
