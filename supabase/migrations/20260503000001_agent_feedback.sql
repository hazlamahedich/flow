-- Agent feedback table (Story 2.7)
-- One feedback per user per run, idempotent upsert

CREATE TABLE agent_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sentiment text NOT NULL CHECK (sentiment IN ('positive', 'negative')),
  note text NULL CHECK (length(note) <= 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, user_id)
);

CREATE INDEX idx_agent_feedback_workspace_run ON agent_feedback (workspace_id, run_id);
CREATE INDEX idx_agent_feedback_user ON agent_feedback (user_id);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION fn_agent_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_agent_feedback_updated_at
  BEFORE UPDATE ON agent_feedback
  FOR EACH ROW
  EXECUTE FUNCTION fn_agent_feedback_updated_at();

-- RLS
ALTER TABLE agent_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_feedback_select ON agent_feedback
  FOR SELECT TO authenticated
  USING (workspace_id IN (
    SELECT wm.workspace_id FROM workspace_members wm
    WHERE wm.user_id = auth.uid() AND wm.removed_at IS NULL
  ));

CREATE POLICY agent_feedback_insert ON agent_feedback
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND workspace_id IN (
      SELECT wm.workspace_id FROM workspace_members wm
      WHERE wm.user_id = auth.uid() AND wm.removed_at IS NULL
    )
  );

CREATE POLICY agent_feedback_update ON agent_feedback
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND workspace_id IN (
      SELECT wm.workspace_id FROM workspace_members wm
      WHERE wm.user_id = auth.uid() AND wm.removed_at IS NULL
    )
  );

CREATE POLICY agent_feedback_delete_owner_admin ON agent_feedback
  FOR DELETE TO authenticated
  USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.removed_at IS NULL
        AND wm.role IN ('owner', 'admin')
    )
  );
