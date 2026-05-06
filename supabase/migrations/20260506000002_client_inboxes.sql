-- Migration: Add client_inboxes table (Epic 4, Story 4.1)
-- Purpose: Gmail OAuth inbox connection mapped to clients
-- Related: FR28a, FR28g, AC1-AC6

CREATE TABLE client_inboxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'gmail' CHECK (provider IN ('gmail', 'outlook')),
  email_address text NOT NULL,
  access_type text NOT NULL CHECK (access_type IN ('direct', 'delegated', 'service_account')),
  oauth_state jsonb NOT NULL DEFAULT '{}',
  sync_status text NOT NULL DEFAULT 'disconnected' CHECK (sync_status IN ('connected', 'syncing', 'error', 'disconnected')),
  sync_cursor text,
  error_message text,
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_client_inboxes_workspace_email
  ON client_inboxes (workspace_id, LOWER(email_address));

CREATE INDEX idx_client_inboxes_workspace_client
  ON client_inboxes (workspace_id, client_id);

CREATE INDEX idx_client_inboxes_sync_status
  ON client_inboxes (workspace_id, sync_status) WHERE sync_status IN ('connected', 'syncing');

ALTER TABLE client_inboxes ENABLE ROW LEVEL SECURITY;

CREATE POLICY rls_client_inboxes_owner_admin ON client_inboxes
  FOR ALL TO authenticated
  USING (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = client_inboxes.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
        AND wm.status = 'active'
    )
  )
  WITH CHECK (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = client_inboxes.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
        AND wm.status = 'active'
    )
  );

CREATE POLICY rls_client_inboxes_member_select ON client_inboxes
  FOR SELECT TO authenticated
  USING (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = client_inboxes.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
    AND EXISTS (
      SELECT 1 FROM member_client_access mca
      WHERE mca.client_id = client_inboxes.client_id
        AND mca.user_id = auth.uid()
        AND mca.workspace_id = client_inboxes.workspace_id
        AND mca.revoked_at IS NULL
    )
  );

CREATE POLICY rls_client_inboxes_service_role ON client_inboxes
  FOR ALL TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER set_client_inboxes_updated_at
  BEFORE UPDATE ON client_inboxes
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime('updated_at');
