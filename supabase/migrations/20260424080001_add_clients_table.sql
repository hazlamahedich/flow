-- Create clients table for onboarding wizard (Story 1.10)
-- Full client features deferred to Epic 3

CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_clients_workspace_id ON clients (workspace_id);

CREATE POLICY policy_clients_select_member ON clients
  FOR SELECT TO authenticated
  USING (
    workspace_id::text = (auth.jwt()->>'workspace_id')
  );

CREATE POLICY policy_clients_insert_member ON clients
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id::text = (auth.jwt()->>'workspace_id')
  );

CREATE POLICY policy_clients_update_member ON clients
  FOR UPDATE TO authenticated
  USING (
    workspace_id::text = (auth.jwt()->>'workspace_id')
  )
  WITH CHECK (
    workspace_id::text = (auth.jwt()->>'workspace_id')
  );
