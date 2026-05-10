-- Migration: Fix over-broad RLS policies on time_entries and projects
-- Purpose: Correct two exploitable policies identified post-Epic-4 review
--   Fix 1 — time_entries UPDATE: scope member policy to own rows only;
--            rename misnamed policy_time_entries_delete_admin → policy_time_entries_update_admin
--   Fix 2 — projects INSERT/UPDATE: enforce client_id scoping for members
--            via member_client_access in BOTH USING and WITH CHECK
-- Depends: 20260510000001_create_projects_table.sql
--          20260510000002_evolve_time_entries.sql

-- ============================================================
-- FIX 1: time_entries UPDATE policies
-- ============================================================

-- Drop the over-broad member UPDATE policy.
-- Original (20260424080002) only checked workspace_id, allowing any workspace member
-- to UPDATE any row — including other users' time entries.
DROP POLICY IF EXISTS policy_time_entries_update_member ON time_entries;

-- Drop the misnamed admin policy (named _delete_admin but was FOR UPDATE).
-- Also drop the correctly-named variant in case it exists from 20260510000002,
-- so we own the final definition of both policies in this migration.
DROP POLICY IF EXISTS policy_time_entries_delete_admin ON time_entries;
DROP POLICY IF EXISTS policy_time_entries_update_admin  ON time_entries;

-- Member UPDATE: restricted to the member's own entries only.
-- USING guards the pre-update row; WITH CHECK guards the post-update row.
-- Both must carry user_id = auth.uid() so a member cannot retarget someone else's row
-- by manipulating the WHERE clause vs. the SET clause independently.
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

-- Admin UPDATE: owner/admin may update any non-deleted entry in their workspace.
-- Covers admin soft-delete today; covers admin editing others' entries in Story 5.3.
-- WITH CHECK only re-validates workspace_id because the USING clause already confirmed
-- the actor holds an owner/admin role before the update begins.
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

-- ============================================================
-- FIX 2: projects INSERT and UPDATE policies
-- ============================================================

-- Drop the INSERT policy that lacked an explicit member-role guard on the mca branch,
-- allowing ambiguous role paths to slip through.
DROP POLICY IF EXISTS policy_projects_insert_member ON projects;

-- Drop the UPDATE policy whose WITH CHECK only tested workspace_id.
-- That gap let a member pass USING (via their current client_id access), then SET
-- client_id to an inaccessible client — the post-update row was never re-validated
-- against member_client_access, so the reassignment was accepted.
DROP POLICY IF EXISTS policy_projects_update_member ON projects;

-- INSERT: owner/admin unrestricted within workspace; member must have a non-revoked
-- member_client_access row for the specific client_id of the project being created.
CREATE POLICY policy_projects_insert_member ON projects
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id::text = (auth.jwt()->>'workspace_id')
    AND (
      -- Owner/admin branch: full insert rights across all clients in this workspace
      EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = projects.workspace_id
          AND wm.user_id = auth.uid()
          AND wm.role IN ('owner', 'admin')
          AND wm.status = 'active'
      )
      OR
      -- Member branch: must be an active member AND hold non-revoked access
      -- to the exact client_id being assigned to the new project.
      (
        EXISTS (
          SELECT 1 FROM workspace_members wm
          WHERE wm.workspace_id = projects.workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role = 'member'
            AND wm.status = 'active'
        )
        AND EXISTS (
          SELECT 1 FROM member_client_access mca
          WHERE mca.client_id    = projects.client_id
            AND mca.workspace_id = projects.workspace_id
            AND mca.user_id      = auth.uid()
            AND mca.revoked_at   IS NULL
        )
      )
    )
  );

-- UPDATE: owner/admin unrestricted; member restricted to accessible clients in BOTH
-- USING (pre-update row) and WITH CHECK (post-update row).
-- The dual enforcement closes the client_id reassignment vector: a member who
-- can currently see project P (client A) cannot UPDATE it to point at client B
-- unless they also hold non-revoked member_client_access for client B.
CREATE POLICY policy_projects_update_member ON projects
  FOR UPDATE TO authenticated
  USING (
    workspace_id::text = (auth.jwt()->>'workspace_id')
    AND (
      -- Owner/admin: full access to pre-update row
      EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = projects.workspace_id
          AND wm.user_id = auth.uid()
          AND wm.role IN ('owner', 'admin')
          AND wm.status = 'active'
      )
      OR
      -- Member: pre-update row's client_id must be accessible
      (
        EXISTS (
          SELECT 1 FROM workspace_members wm
          WHERE wm.workspace_id = projects.workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role = 'member'
            AND wm.status = 'active'
        )
        AND EXISTS (
          SELECT 1 FROM member_client_access mca
          WHERE mca.client_id    = projects.client_id
            AND mca.workspace_id = projects.workspace_id
            AND mca.user_id      = auth.uid()
            AND mca.revoked_at   IS NULL
        )
      )
    )
  )
  WITH CHECK (
    workspace_id::text = (auth.jwt()->>'workspace_id')
    AND (
      -- Owner/admin: full access to post-update row
      EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = projects.workspace_id
          AND wm.user_id = auth.uid()
          AND wm.role IN ('owner', 'admin')
          AND wm.status = 'active'
      )
      OR
      -- Member: post-update row's client_id must also be accessible.
      -- This is the critical check that was missing from the original policy —
      -- without it a member could reassign any project to an arbitrary client_id.
      (
        EXISTS (
          SELECT 1 FROM workspace_members wm
          WHERE wm.workspace_id = projects.workspace_id
            AND wm.user_id = auth.uid()
            AND wm.role = 'member'
            AND wm.status = 'active'
        )
        AND EXISTS (
          SELECT 1 FROM member_client_access mca
          WHERE mca.client_id    = projects.client_id
            AND mca.workspace_id = projects.workspace_id
            AND mca.user_id      = auth.uid()
            AND mca.revoked_at   IS NULL
        )
      )
    )
  );
