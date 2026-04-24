-- Trust matrix table: per-agent per-action-type trust configuration
-- Related: Story 2.3 - Trust Matrix & Graduation System

CREATE TABLE trust_matrix (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_id              agent_id_type NOT NULL,
  action_type           TEXT NOT NULL,
  current_level         trust_level NOT NULL DEFAULT 'supervised',
  score                 SMALLINT NOT NULL DEFAULT 0,
  total_executions      INTEGER NOT NULL DEFAULT 0,
  successful_executions INTEGER NOT NULL DEFAULT 0,
  consecutive_successes INTEGER NOT NULL DEFAULT 0,
  violation_count       INTEGER NOT NULL DEFAULT 0,
  last_transition_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_violation_at     TIMESTAMPTZ,
  cooldown_until        TIMESTAMPTZ,
  version               INTEGER NOT NULL DEFAULT 1,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, agent_id, action_type),
  CONSTRAINT chk_score_range CHECK (score >= 0 AND score <= 200)
);

CREATE UNIQUE INDEX idx_trust_matrix_cell ON trust_matrix(workspace_id, agent_id, action_type);
CREATE INDEX idx_trust_matrix_workspace ON trust_matrix(workspace_id, agent_id);
CREATE INDEX idx_trust_matrix_workspace_text ON trust_matrix((workspace_id::text));
CREATE INDEX idx_trust_matrix_cooldown ON trust_matrix(cooldown_until) WHERE cooldown_until IS NOT NULL;
