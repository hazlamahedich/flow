-- Migration: Evolve time_entries table for Epic 5
-- Purpose: Add project FK, soft-delete support, rename description→notes, update RLS
-- Related: Story 5.1 AC#7
-- Depends: 20260510000001_create_projects_table.sql (projects table must exist)

-- Rename description → notes
ALTER TABLE time_entries RENAME COLUMN description TO notes;

-- Add project FK (nullable, SET NULL on project deletion)
ALTER TABLE time_entries ADD COLUMN project_id uuid REFERENCES projects(id) ON DELETE SET NULL;

-- Soft-delete support
ALTER TABLE time_entries ADD COLUMN deleted_at timestamptz;

-- Composite index for FR50 filters and get_scope_creep_alerts RPC
CREATE INDEX idx_time_entries_workspace_client_date ON time_entries (workspace_id, client_id, date);

-- ============================================================
-- DROP OLD RLS POLICIES
-- ============================================================

DROP POLICY IF EXISTS policy_time_entries_select_member ON time_entries;
DROP POLICY IF EXISTS policy_time_entries_insert_member ON time_entries;
DROP POLICY IF EXISTS policy_time_entries_update_member ON time_entries;

-- ============================================================
-- NEW TIME_ENTRIES RLS POLICIES (two-tier: owner/admin vs member)
-- ============================================================

-- SELECT: owner/admin can see all non-deleted entries in workspace
CREATE POLICY policy_time_entries_select_owner_admin ON time_entries
  FOR SELECT TO authenticated
  USING (
    workspace_id::text = (auth.jwt()->>'workspace_id')
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = time_entries.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
      AND wm.status = 'active'
    )
  );

-- SELECT: member can only see entries for clients they have access to
CREATE POLICY policy_time_entries_select_member ON time_entries
  FOR SELECT TO authenticated
  USING (
    workspace_id::text = (auth.jwt()->>'workspace_id')
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = time_entries.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role = 'member'
      AND wm.status = 'active'
    )
    AND EXISTS (
      SELECT 1 FROM member_client_access mca
      WHERE mca.client_id = time_entries.client_id
      AND mca.workspace_id = time_entries.workspace_id
      AND mca.user_id = auth.uid()
      AND mca.revoked_at IS NULL
    )
  );

-- INSERT: owner/admin can insert for any client, always attributed to themselves
CREATE POLICY policy_time_entries_insert_admin ON time_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id::text = (auth.jwt()->>'workspace_id')
    AND user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = time_entries.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
      AND wm.status = 'active'
    )
  );

-- INSERT: members can only insert for clients they have access to, attributed to themselves
CREATE POLICY policy_time_entries_insert_member ON time_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id::text = (auth.jwt()->>'workspace_id')
    AND user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = time_entries.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role = 'member'
      AND wm.status = 'active'
    )
    AND EXISTS (
      SELECT 1 FROM member_client_access mca
      WHERE mca.client_id = time_entries.client_id
      AND mca.workspace_id = time_entries.workspace_id
      AND mca.user_id = auth.uid()
      AND mca.revoked_at IS NULL
    )
  );

-- (member UPDATE and admin UPDATE policies defined below alongside soft-delete)

-- UPDATE/soft-delete: members can only update their own entries
-- (covers soft-delete today; covers self-edit in Story 5.3)
CREATE POLICY policy_time_entries_update_member ON time_entries
  FOR UPDATE TO authenticated
  USING (
    workspace_id::text = (auth.jwt()->>'workspace_id')
    AND user_id = auth.uid()
    AND deleted_at IS NULL
  )
  WITH CHECK (
    workspace_id::text = (auth.jwt()->>'workspace_id')
    AND user_id = auth.uid()
  );

-- UPDATE/soft-delete: owners/admins can update any entry in workspace
-- (covers admin soft-delete today; covers admin editing others' entries in Story 5.3)
CREATE POLICY policy_time_entries_update_admin ON time_entries
  FOR UPDATE TO authenticated
  USING (
    workspace_id::text = (auth.jwt()->>'workspace_id')
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = time_entries.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
      AND wm.status = 'active'
    )
  )
  WITH CHECK (
    workspace_id::text = (auth.jwt()->>'workspace_id')
  );
