-- Migration: Add emails table (Epic 4, Story 4.1)
-- Purpose: Email metadata storage for inbox agent processing
-- Related: FR28a, AC5, AC8

CREATE TABLE emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_inbox_id uuid NOT NULL REFERENCES client_inboxes(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  gmail_message_id text NOT NULL,
  gmail_thread_id text,
  subject text,
  from_address text NOT NULL,
  from_name text,
  to_addresses jsonb NOT NULL DEFAULT '[]',
  cc_addresses jsonb NOT NULL DEFAULT '[]',
  received_at timestamptz NOT NULL,
  body_clean text,
  body_raw_safe text,
  headers jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_emails_workspace_gmail_message
  ON emails (workspace_id, gmail_message_id);

CREATE INDEX idx_emails_workspace_inbox_received
  ON emails (workspace_id, client_inbox_id, received_at DESC);

CREATE INDEX idx_emails_workspace_client_received
  ON emails (workspace_id, client_id, received_at DESC);

CREATE INDEX idx_emails_thread
  ON emails (workspace_id, gmail_thread_id);

ALTER TABLE emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY rls_emails_owner_admin ON emails
  FOR ALL TO authenticated
  USING (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = emails.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
        AND wm.status = 'active'
    )
  )
  WITH CHECK (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = emails.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
        AND wm.status = 'active'
    )
  );

CREATE POLICY rls_emails_member_select ON emails
  FOR SELECT TO authenticated
  USING (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = emails.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
    AND EXISTS (
      SELECT 1 FROM member_client_access mca
      WHERE mca.client_id = emails.client_id
        AND mca.user_id = auth.uid()
        AND mca.workspace_id = emails.workspace_id
        AND mca.revoked_at IS NULL
    )
  );

CREATE POLICY rls_emails_service_role ON emails
  FOR ALL TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
