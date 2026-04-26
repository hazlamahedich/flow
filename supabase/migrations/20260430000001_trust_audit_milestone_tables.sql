-- Trust audit and milestone tables for Story 2.6a
-- Related: FR29, FR33 (Trust Badge Display & Agent Status Indicators)

CREATE TABLE trust_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_id text NOT NULL,
  last_reviewed_at timestamptz NOT NULL DEFAULT now(),
  review_count integer NOT NULL DEFAULT 0,
  deferred_count integer NOT NULL DEFAULT 0,
  last_deferred_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, agent_id)
);

CREATE TABLE trust_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_id text NOT NULL,
  milestone_type text NOT NULL,
  threshold integer NOT NULL,
  achieved_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, agent_id, milestone_type)
);

CREATE INDEX idx_trust_audits_workspace_reviewed ON trust_audits (workspace_id, last_reviewed_at);
CREATE INDEX idx_trust_milestones_workspace_agent ON trust_milestones (workspace_id, agent_id);

-- Text-cast indexes for RLS JWT comparisons
CREATE INDEX idx_trust_audits_workspace_text ON trust_audits ((workspace_id::text));
CREATE INDEX idx_trust_milestones_workspace_text ON trust_milestones ((workspace_id::text));

-- RLS
ALTER TABLE trust_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY policy_trust_audits_select_member ON trust_audits
  FOR SELECT TO authenticated
  USING (
    workspace_id IN (
      SELECT w.id FROM workspaces w
      INNER JOIN workspace_members wm ON wm.workspace_id = w.id
      WHERE wm.user_id = auth.uid()
    )
  );

CREATE POLICY policy_trust_audits_insert_member ON trust_audits
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IN (
      SELECT w.id FROM workspaces w
      INNER JOIN workspace_members wm ON wm.workspace_id = w.id
      WHERE wm.user_id = auth.uid()
    )
  );

CREATE POLICY policy_trust_audits_update_member ON trust_audits
  FOR UPDATE TO authenticated
  USING (
    workspace_id IN (
      SELECT w.id FROM workspaces w
      INNER JOIN workspace_members wm ON wm.workspace_id = w.id
      WHERE wm.user_id = auth.uid()
    )
  );

CREATE POLICY policy_trust_milestones_select_member ON trust_milestones
  FOR SELECT TO authenticated
  USING (
    workspace_id IN (
      SELECT w.id FROM workspaces w
      INNER JOIN workspace_members wm ON wm.workspace_id = w.id
      WHERE wm.user_id = auth.uid()
    )
  );

CREATE POLICY policy_trust_milestones_insert_member ON trust_milestones
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IN (
      SELECT w.id FROM workspaces w
      INNER JOIN workspace_members wm ON wm.workspace_id = w.id
      WHERE wm.user_id = auth.uid()
    )
  );

CREATE POLICY policy_trust_milestones_update_member ON trust_milestones
  FOR UPDATE TO authenticated
  USING (
    workspace_id IN (
      SELECT w.id FROM workspaces w
      INNER JOIN workspace_members wm ON wm.workspace_id = w.id
      WHERE wm.user_id = auth.uid()
    )
  );

CREATE POLICY policy_trust_audits_delete_owner ON trust_audits
  FOR DELETE TO authenticated
  USING (
    workspace_id IN (
      SELECT w.id FROM workspaces w
      INNER JOIN workspace_members wm ON wm.workspace_id = w.id
      WHERE wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY policy_trust_milestones_delete_owner ON trust_milestones
  FOR DELETE TO authenticated
  USING (
    workspace_id IN (
      SELECT w.id FROM workspaces w
      INNER JOIN workspace_members wm ON wm.workspace_id = w.id
      WHERE wm.user_id = auth.uid() AND wm.role IN ('owner', 'admin')
    )
  );

CREATE OR REPLACE FUNCTION trg_trust_audits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_trust_audits_updated_at
  BEFORE UPDATE ON trust_audits
  FOR EACH ROW EXECUTE FUNCTION trg_trust_audits_updated_at();
