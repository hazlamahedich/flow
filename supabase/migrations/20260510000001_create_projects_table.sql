-- Migration: Create projects table
-- Purpose: Categorize time entries under clients with projects
-- Related: Story 5.1 AC#6

CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active',
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT projects_status_check CHECK (status IN ('active', 'archived')),
  CONSTRAINT projects_status_archived_at_check CHECK (
    (status = 'archived' AND archived_at IS NOT NULL) OR
    (status = 'active' AND archived_at IS NULL)
  ),
  CONSTRAINT projects_unique_name_per_client UNIQUE (workspace_id, client_id, name)
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_projects_workspace_id ON projects (workspace_id);
CREATE INDEX idx_projects_workspace_client ON projects (workspace_id, client_id);

CREATE TRIGGER set_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE PROCEDURE moddatetime(updated_at);

-- ============================================================
-- PROJECTS RLS POLICIES (two-tier: owner/admin vs member)
-- ============================================================

-- SELECT: owner/admin can see all projects in workspace
CREATE POLICY policy_projects_select_owner_admin ON projects
  FOR SELECT TO authenticated
  USING (
    workspace_id::text = (auth.jwt()->>'workspace_id')
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = projects.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'admin')
      AND wm.status = 'active'
    )
  );

-- SELECT: member can only see projects for clients they have access to
CREATE POLICY policy_projects_select_member ON projects
  FOR SELECT TO authenticated
  USING (
    workspace_id::text = (auth.jwt()->>'workspace_id')
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = projects.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role = 'member'
      AND wm.status = 'active'
    )
    AND EXISTS (
      SELECT 1 FROM member_client_access mca
      WHERE mca.client_id = projects.client_id
      AND mca.workspace_id = projects.workspace_id
      AND mca.user_id = auth.uid()
      AND mca.revoked_at IS NULL
    )
  );

-- INSERT: owner/admin unrestricted; member restricted to accessible clients
CREATE POLICY policy_projects_insert_member ON projects
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id::text = (auth.jwt()->>'workspace_id')
    AND (
      EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = projects.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
        AND wm.status = 'active'
      )
      OR EXISTS (
        SELECT 1 FROM member_client_access mca
        WHERE mca.client_id = projects.client_id
        AND mca.workspace_id = projects.workspace_id
        AND mca.user_id = auth.uid()
        AND mca.revoked_at IS NULL
      )
    )
  );

-- UPDATE: owner/admin unrestricted; member restricted to accessible clients
CREATE POLICY policy_projects_update_member ON projects
  FOR UPDATE TO authenticated
  USING (
    workspace_id::text = (auth.jwt()->>'workspace_id')
    AND (
      EXISTS (
        SELECT 1 FROM workspace_members wm
        WHERE wm.workspace_id = projects.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
        AND wm.status = 'active'
      )
      OR EXISTS (
        SELECT 1 FROM member_client_access mca
        WHERE mca.client_id = projects.client_id
        AND mca.workspace_id = projects.workspace_id
        AND mca.user_id = auth.uid()
        AND mca.revoked_at IS NULL
      )
    )
  )
  WITH CHECK (
    workspace_id::text = (auth.jwt()->>'workspace_id')
  );
