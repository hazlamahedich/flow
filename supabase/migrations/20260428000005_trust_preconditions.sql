-- Trust preconditions: user-defined conditions that must pass before agent acts
-- Related: Story 2.3 - Trust Matrix & Graduation System

CREATE TABLE trust_preconditions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_id          agent_id_type NOT NULL,
  action_type       TEXT NOT NULL,
  condition_key     TEXT NOT NULL,
  condition_expr    TEXT NOT NULL,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, agent_id, action_type, condition_key)
);

CREATE INDEX idx_trust_preconditions_workspace ON trust_preconditions(workspace_id, agent_id);
CREATE INDEX idx_trust_preconditions_workspace_text ON trust_preconditions((workspace_id::text));
