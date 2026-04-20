-- Migration: workspace_members table
-- Purpose: Workspace membership with role-based access (FR2)
-- Related: Story 1.2 AC#5
-- Note: Workspace-scoped. Role CHECK constraint. Soft-delete via removed_at.

CREATE TABLE workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'client_user')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  removed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_workspace_members_unique_active
  ON workspace_members (workspace_id, user_id)
  WHERE removed_at IS NULL;

CREATE INDEX idx_workspace_members_workspace_id
  ON workspace_members (workspace_id);

CREATE INDEX idx_workspace_members_user_id
  ON workspace_members (user_id);

CREATE INDEX idx_workspace_members_workspace_user
  ON workspace_members (workspace_id, user_id);

CREATE TRIGGER set_workspace_members_updated_at
  BEFORE UPDATE ON workspace_members
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime('updated_at');
