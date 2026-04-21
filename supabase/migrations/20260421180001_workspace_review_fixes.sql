-- Migration: Code review fixes for Story 1.4a
-- Purpose: Fix RLS gaps, add create_workspace RPC, fix triggers, drop stale policies
-- Related: Code review decisions 1C, 2A, 3A

-- ============================================================
-- DECISION 3A: Drop old removed_at-based RLS policies
-- These coexisted with status-based policies and created a bypass.
-- ============================================================

DROP POLICY IF EXISTS policy_workspaces_select_member ON workspaces;
DROP POLICY IF EXISTS policy_workspaces_update_owner ON workspaces;
DROP POLICY IF EXISTS policy_workspace_members_select_member ON workspace_members;
DROP POLICY IF EXISTS policy_workspace_members_insert_owner ON workspace_members;
DROP POLICY IF EXISTS policy_workspace_members_update_owner ON workspace_members;

-- ============================================================
-- DECISION 2A: Fix prevent_owner_escalation trigger
-- Allow owner role when workspace has zero members (first owner creation)
-- ============================================================

CREATE OR REPLACE FUNCTION prevent_owner_escalation()
RETURNS trigger AS $$
DECLARE
  caller_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.role = 'owner' THEN
    IF NOT EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = NEW.workspace_id
    ) THEN
      RETURN NEW;
    END IF;

    SELECT wm.role INTO caller_role
    FROM workspace_members wm
    WHERE wm.workspace_id = NEW.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.status = 'active';

    IF caller_role IS NULL OR caller_role != 'owner' THEN
      RAISE EXCEPTION 'Only owners can assign the owner role';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_catalog;

-- ============================================================
-- DECISION 1C: SECURITY DEFINER RPC for workspace creation
-- Atomic: inserts workspace + owner membership in one transaction
-- ============================================================

CREATE OR REPLACE FUNCTION create_workspace(
  p_name text,
  p_slug text,
  p_owner_id uuid
)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  settings jsonb
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO workspaces (name, slug, created_by)
  VALUES (p_name, p_slug, p_owner_id)
  RETURNING id INTO v_id;

  INSERT INTO workspace_members (workspace_id, user_id, role, status)
  VALUES (v_id, p_owner_id, 'owner', 'active');

  RETURN QUERY
    SELECT w.id, w.name, w.slug, w.created_by, w.created_at, w.updated_at, w.settings
    FROM workspaces w
    WHERE w.id = v_id;
END;
$$;

-- ============================================================
-- FIX: accept_invitation now verifies accepting user's email
-- ============================================================

CREATE OR REPLACE FUNCTION accept_invitation(p_token uuid)
RETURNS uuid AS $$
DECLARE
  v_invitation RECORD;
  v_user_email text;
BEGIN
  v_user_email := auth.jwt()->>'email';

  SELECT * INTO v_invitation
  FROM workspace_invitations
  WHERE token_hash = encode(digest(p_token::text, 'sha256'), 'hex')
    AND accepted_at IS NULL
    AND expires_at > now()
    AND email = v_user_email
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found, already accepted, expired, or not addressed to you';
  END IF;

  INSERT INTO workspace_members (workspace_id, user_id, role, status)
  VALUES (v_invitation.workspace_id, auth.uid(), v_invitation.role, 'active')
  ON CONFLICT (workspace_id, user_id)
  DO UPDATE SET status = 'active', role = EXCLUDED.role, updated_at = now()
  WHERE workspace_members.status = 'revoked';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User is already a member of this workspace';
  END IF;

  UPDATE workspace_invitations SET accepted_at = now() WHERE id = v_invitation.id;

  RETURN v_invitation.workspace_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_catalog;

-- ============================================================
-- FIX: transfer_requests self-transfer prevention
-- ============================================================

ALTER TABLE transfer_requests DROP CONSTRAINT IF EXISTS transfer_requests_no_self_transfer;
ALTER TABLE transfer_requests ADD CONSTRAINT transfer_requests_no_self_transfer
  CHECK (from_user_id != to_user_id);

-- ============================================================
-- FIX: rls_workspace_members_expiry now verifies caller is member
-- ============================================================

DROP POLICY IF EXISTS rls_workspace_members_expiry ON workspace_members;

CREATE POLICY rls_workspace_members_expiry ON workspace_members
  FOR SELECT
  TO authenticated
  USING (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > now())
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

-- ============================================================
-- FIX: Drop workspace_members unique index on removed_at,
-- replace with status-based index
-- ============================================================

DROP INDEX IF EXISTS idx_workspace_members_unique_active;
CREATE UNIQUE INDEX idx_workspace_members_unique_active
  ON workspace_members (workspace_id, user_id) WHERE status = 'active';
