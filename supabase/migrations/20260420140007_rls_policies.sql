-- Migration: RLS policies for all workspace-scoped tables
-- Purpose: Defense-in-depth row-level security with workspace_id::text cast
-- Related: Story 1.2 AC#2, AC#7
-- Note: CRITICAL - Every policy uses workspace_id::text = auth.jwt()->>'workspace_id'
--       The ::text cast is NOT optional (uuid vs text silently denies all queries).
-- Service role bypass: service_role bypasses RLS by default in Supabase.
-- Allowed service-role operations: agent execution context, system webhooks.

-- ============================================================
-- WORKSPACES RLS POLICIES
-- ============================================================

-- Members can read own workspace
CREATE POLICY policy_workspaces_select_member ON workspaces
  FOR SELECT
  TO authenticated
  USING (
    id::text = auth.jwt()->>'workspace_id'
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspaces.id
      AND wm.user_id = auth.uid()
      AND wm.removed_at IS NULL
    )
  );

-- Owner can update workspace name/settings
CREATE POLICY policy_workspaces_update_owner ON workspaces
  FOR UPDATE
  TO authenticated
  USING (
    id::text = auth.jwt()->>'workspace_id'
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspaces.id
      AND wm.user_id = auth.uid()
      AND wm.role = 'owner'
      AND wm.removed_at IS NULL
    )
  )
  WITH CHECK (
    id::text = auth.jwt()->>'workspace_id'
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspaces.id
      AND wm.user_id = auth.uid()
      AND wm.role = 'owner'
      AND wm.removed_at IS NULL
    )
  );

-- Only service_role can delete workspaces
-- (No DELETE policy for authenticated users — service_role bypasses RLS)

-- Only service_role can insert workspaces
-- (No INSERT policy for authenticated users — workspace creation via service_role)

-- ============================================================
-- WORKSPACE_MEMBERS RLS POLICIES
-- ============================================================

-- Members can read own workspace's members (non-deleted)
CREATE POLICY policy_workspace_members_select_member ON workspace_members
  FOR SELECT
  TO authenticated
  USING (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.removed_at IS NULL
    )
    AND (
      workspace_members.removed_at IS NULL
      OR EXISTS (
        SELECT 1 FROM workspace_members wm2
        WHERE wm2.workspace_id = workspace_members.workspace_id
        AND wm2.user_id = auth.uid()
        AND wm2.role IN ('owner', 'admin')
        AND wm2.removed_at IS NULL
      )
    )
  );

-- Owner/Admin can insert members
CREATE POLICY policy_workspace_members_insert_owner ON workspace_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
      AND wm.removed_at IS NULL
    )
  );

-- Owner/Admin can update members (e.g., role changes)
CREATE POLICY policy_workspace_members_update_owner ON workspace_members
  FOR UPDATE
  TO authenticated
  USING (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
      AND wm.removed_at IS NULL
    )
  )
  WITH CHECK (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
      AND wm.removed_at IS NULL
    )
  );

-- No DELETE policy for authenticated users — soft-delete only via UPDATE SET removed_at.
-- service_role bypasses RLS for compliance/GDPR hard-delete when needed.

-- ============================================================
-- WORKSPACE_MEMBERS ROLE PROTECTION TRIGGERS
-- ============================================================

-- Prevent non-owner from assigning owner role
CREATE OR REPLACE FUNCTION prevent_owner_escalation()
RETURNS trigger AS $$
DECLARE
  caller_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.role = 'owner' THEN
    SELECT wm.role INTO caller_role
    FROM workspace_members wm
    WHERE wm.workspace_id = NEW.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.removed_at IS NULL;

    IF caller_role IS NULL OR caller_role != 'owner' THEN
      RAISE EXCEPTION 'Only owners can assign the owner role';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_catalog;

CREATE TRIGGER trigger_prevent_owner_escalation
  BEFORE INSERT ON workspace_members
  FOR EACH ROW
  EXECUTE FUNCTION prevent_owner_escalation();

-- Prevent self-role-change and ensure workspace always has at least one active owner
CREATE OR REPLACE FUNCTION prevent_unsafe_role_change()
RETURNS trigger AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id = auth.uid() AND NEW.role != OLD.role THEN
    RAISE EXCEPTION 'Cannot change your own role';
  END IF;

  IF OLD.role = 'owner' AND NEW.role != 'owner' THEN
    IF NOT EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = NEW.workspace_id
        AND wm.user_id != NEW.user_id
        AND wm.role = 'owner'
        AND wm.removed_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Cannot demote the last owner. Transfer ownership first.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_catalog;

CREATE TRIGGER trigger_prevent_unsafe_role_change
  BEFORE UPDATE ON workspace_members
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION prevent_unsafe_role_change();

-- ============================================================
-- AUDIT_LOG RLS POLICIES
-- ============================================================

-- All workspace members can read own workspace entries
CREATE POLICY policy_audit_log_select_member ON audit_log
  FOR SELECT
  TO authenticated
  USING (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = audit_log.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.removed_at IS NULL
    )
  );

-- Only service_role can insert audit entries (via triggers/system)
-- No INSERT/UPDATE/DELETE policies for authenticated users
-- Append-only enforcement is at trigger level (see audit_log migration)
