-- Migration: Workspace management tables (invitations, client access, transfers)
-- Purpose: Foundation schema for Stories 1.4a, 1.4b, 1.4c
-- Related: Story 1.4a AC#1, AC#2, AC#3, AC#4, AC#5
-- Note: member_client_access.client_id FK to clients(id) deferred until
--       clients table is created in Epic 3 (Story 3-1).

-- ============================================================
-- STEP 1: Extend workspaces with slug and created_by
-- ============================================================

-- Add slug column (nullable first for backfill)
ALTER TABLE workspaces ADD COLUMN slug text;
ALTER TABLE workspaces ADD COLUMN created_by uuid REFERENCES auth.users(id);

-- Backfill slug from id for existing rows
UPDATE workspaces SET slug = replace(id::text, '-', '') WHERE slug IS NULL;

-- Now make slug NOT NULL and unique
ALTER TABLE workspaces ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX idx_workspaces_slug ON workspaces (slug);

-- ============================================================
-- STEP 2: Add status column to workspace_members
-- ============================================================

ALTER TABLE workspace_members ADD COLUMN status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'expired', 'revoked'));

-- Backfill: rows with removed_at set are revoked
UPDATE workspace_members SET status = 'revoked' WHERE removed_at IS NOT NULL;

-- Add expires_at CHECK constraint (expires_at must be after joined_at or NULL)
ALTER TABLE workspace_members DROP CONSTRAINT IF EXISTS workspace_members_expires_at_check;
ALTER TABLE workspace_members ADD CONSTRAINT workspace_members_expires_at_check
  CHECK (expires_at IS NULL OR expires_at > joined_at);

-- ============================================================
-- STEP 3: Create workspace_invitations table
-- ============================================================

CREATE TABLE workspace_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'member')),
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 4: Create member_client_access table
-- ============================================================
-- Note: FK to clients(id) deferred — added by Story 3-1

CREATE TABLE member_client_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  granted_by uuid NOT NULL REFERENCES auth.users(id),
  granted_at timestamptz DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE(workspace_id, user_id, client_id)
);

ALTER TABLE member_client_access ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 5: Create transfer_requests table
-- ============================================================

CREATE TABLE transfer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL REFERENCES auth.users(id),
  to_user_id uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  accepted_at timestamptz
);

ALTER TABLE transfer_requests ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 6: Indexes
-- ============================================================

-- workspace_invitations indexes
CREATE UNIQUE INDEX idx_invitations_token_hash
  ON workspace_invitations (token_hash);

CREATE UNIQUE INDEX one_pending_invitation_per_workspace_email
  ON workspace_invitations (workspace_id, email) WHERE accepted_at IS NULL;

-- member_client_access index
CREATE INDEX idx_member_client_access_workspace_user
  ON member_client_access (workspace_id, user_id);

-- transfer_requests partial unique index
CREATE UNIQUE INDEX one_pending_transfer_per_workspace
  ON transfer_requests (workspace_id) WHERE status = 'pending';

-- ============================================================
-- STEP 7: SECURITY DEFINER RPC accept_invitation
-- ============================================================

CREATE OR REPLACE FUNCTION accept_invitation(p_token uuid)
RETURNS uuid AS $$
DECLARE
  v_invitation RECORD;
BEGIN
  SELECT * INTO v_invitation
  FROM workspace_invitations
  WHERE token_hash = encode(digest(p_token::text, 'sha256'), 'hex')
    AND accepted_at IS NULL
    AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found, already accepted, or expired';
  END IF;

  INSERT INTO workspace_members (workspace_id, user_id, role, status)
  VALUES (v_invitation.workspace_id, auth.uid(), v_invitation.role, 'active')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  UPDATE workspace_invitations SET accepted_at = now() WHERE id = v_invitation.id;

  RETURN v_invitation.workspace_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_catalog;

-- ============================================================
-- STEP 8: updated_at trigger for workspace_members
-- ============================================================
-- Note: workspace_members already has a moddatetime trigger from Story 1.2.
-- This is a custom trigger that handles the status column updates.
-- The existing moddatetime trigger handles updated_at automatically.

-- ============================================================
-- STEP 9: RLS policies
-- ============================================================

-- ---- workspaces ----
-- Members can SELECT their workspace (status-based)
CREATE POLICY rls_workspaces_member_select ON workspaces
  FOR SELECT
  TO authenticated
  USING (
    id::text = auth.jwt()->>'workspace_id'
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspaces.id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

-- ---- workspace_members ----
-- Owner full CRUD
CREATE POLICY rls_workspace_members_owner_all ON workspace_members
  FOR ALL
  TO authenticated
  USING (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'owner'
        AND wm.status = 'active'
    )
  )
  WITH CHECK (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'owner'
        AND wm.status = 'active'
    )
  );

-- Admin can SELECT and INSERT Members
CREATE POLICY rls_workspace_members_admin_select_insert ON workspace_members
  FOR SELECT
  TO authenticated
  USING (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'admin'
        AND wm.status = 'active'
    )
  );

CREATE POLICY rls_workspace_members_admin_insert ON workspace_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
        AND wm.status = 'active'
    )
  );

-- Active member expiry check policy
CREATE POLICY rls_workspace_members_expiry ON workspace_members
  FOR SELECT
  TO authenticated
  USING (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > now())
  );

-- Members can SELECT memberships in their workspace
CREATE POLICY rls_workspace_members_member_select ON workspace_members
  FOR SELECT
  TO authenticated
  USING (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

-- ---- workspace_invitations ----
-- Workspace members see invitations
CREATE POLICY rls_workspace_invitations_member_select ON workspace_invitations
  FOR SELECT
  TO authenticated
  USING (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_invitations.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

-- Owner/Admin create invitations
CREATE POLICY rls_workspace_invitations_owner_admin_insert ON workspace_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_invitations.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
        AND wm.status = 'active'
    )
  );

-- Owner/Admin can DELETE (revoke pending invitations)
CREATE POLICY rls_workspace_invitations_owner_admin_delete ON workspace_invitations
  FOR DELETE
  TO authenticated
  USING (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_invitations.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
        AND wm.status = 'active'
    )
  );

-- ---- member_client_access ----
-- Members see only own rows; Owner/Admin see all; Owner/Admin can INSERT/UPDATE/DELETE
CREATE POLICY rls_member_client_access_scoped ON member_client_access
  FOR ALL
  TO authenticated
  USING (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = member_client_access.workspace_id
          AND wm.user_id = auth.uid()
          AND wm.role IN ('owner', 'admin')
          AND wm.status = 'active'
      )
    )
  )
  WITH CHECK (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = member_client_access.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
        AND wm.status = 'active'
    )
  );

-- ---- transfer_requests ----
-- Only current Owner can SELECT/INSERT/UPDATE
CREATE POLICY rls_transfer_requests_owner ON transfer_requests
  FOR ALL
  TO authenticated
  USING (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = transfer_requests.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'owner'
        AND wm.status = 'active'
    )
  )
  WITH CHECK (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = transfer_requests.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'owner'
        AND wm.status = 'active'
    )
  );
