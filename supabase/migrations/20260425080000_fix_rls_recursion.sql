-- Migration: Fix self-referential RLS recursion on workspace_members and related tables
-- Purpose: workspace_members RLS policies query workspace_members in a subquery,
--          causing infinite recursion. Replace with JWT-claim-based checks.
-- Pattern: Trust auth.jwt() claims (set during login/workspace switch by server actions).
--          Claims contain workspace_id and role — use them directly instead of subqueries.

-- ============================================================
-- workspace_members: drop all existing policies
-- ============================================================
DROP POLICY IF EXISTS rls_workspace_members_admin_insert ON workspace_members;
DROP POLICY IF EXISTS rls_workspace_members_admin_select_insert ON workspace_members;
DROP POLICY IF EXISTS rls_workspace_members_expiry ON workspace_members;
DROP POLICY IF EXISTS rls_workspace_members_member_select ON workspace_members;
DROP POLICY IF EXISTS rls_workspace_members_owner_all ON workspace_members;

-- Owner: full CRUD on members in own workspace (JWT role = 'owner')
CREATE POLICY rls_workspace_members_owner_all ON workspace_members
  FOR ALL
  TO authenticated
  USING (
    (workspace_id)::text = (auth.jwt() ->> 'workspace_id'::text)
    AND (auth.jwt() ->> 'role'::text) = 'owner'
    AND status = 'active'
  )
  WITH CHECK (
    (workspace_id)::text = (auth.jwt() ->> 'workspace_id'::text)
    AND (auth.jwt() ->> 'role'::text) = 'owner'
  );

-- Admin: can select + insert (members only)
CREATE POLICY rls_workspace_members_admin_select ON workspace_members
  FOR SELECT
  TO authenticated
  USING (
    (workspace_id)::text = (auth.jwt() ->> 'workspace_id'::text)
    AND status = 'active'
  );

CREATE POLICY rls_workspace_members_admin_insert ON workspace_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (workspace_id)::text = (auth.jwt() ->> 'workspace_id'::text)
    AND (auth.jwt() ->> 'role'::text) IN ('owner', 'admin')
    AND role IN ('member', 'client_user')
  );

CREATE POLICY rls_workspace_members_admin_update ON workspace_members
  FOR UPDATE
  TO authenticated
  USING (
    (workspace_id)::text = (auth.jwt() ->> 'workspace_id'::text)
    AND (auth.jwt() ->> 'role'::text) IN ('owner', 'admin')
  )
  WITH CHECK (
    (workspace_id)::text = (auth.jwt() ->> 'workspace_id'::text)
    AND (auth.jwt() ->> 'role'::text) IN ('owner', 'admin')
  );

-- ============================================================
-- workspaces: simplify to JWT-based check
-- ============================================================
DROP POLICY IF EXISTS rls_workspaces_select ON workspaces;
CREATE POLICY rls_workspaces_select ON workspaces
  FOR SELECT
  TO authenticated
  USING (
    (id)::text = (auth.jwt() ->> 'workspace_id'::text)
  );

-- ============================================================
-- audit_log: simplify to JWT-based check
-- ============================================================
DROP POLICY IF EXISTS rls_audit_log_workspace_read ON audit_log;
DROP POLICY IF EXISTS rls_audit_log_select ON audit_log;
CREATE POLICY rls_audit_log_select ON audit_log
  FOR SELECT
  TO authenticated
  USING (
    (workspace_id)::text = (auth.jwt() ->> 'workspace_id'::text)
  );
