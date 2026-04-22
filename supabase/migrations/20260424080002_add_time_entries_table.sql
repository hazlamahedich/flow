-- Create time_entries table for onboarding wizard (Story 1.10)
-- Full time tracking deferred to Epic 5

CREATE TABLE time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date date NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_time_entries_workspace_id ON time_entries (workspace_id);
CREATE INDEX idx_time_entries_client_id ON time_entries (client_id);
CREATE INDEX idx_time_entries_user_id ON time_entries (user_id);

CREATE POLICY policy_time_entries_select_member ON time_entries
  FOR SELECT TO authenticated
  USING (
    workspace_id::text = (auth.jwt()->>'workspace_id')
  );

CREATE POLICY policy_time_entries_insert_member ON time_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id::text = (auth.jwt()->>'workspace_id')
  );

CREATE POLICY policy_time_entries_update_member ON time_entries
  FOR UPDATE TO authenticated
  USING (
    workspace_id::text = (auth.jwt()->>'workspace_id')
  )
  WITH CHECK (
    workspace_id::text = (auth.jwt()->>'workspace_id')
  );
