-- Trust snapshots: point-in-time trust state captured before each agent action
-- Related: Story 2.3 - Trust Matrix & Graduation System
-- Retention: 90 days via pg_cron nightly purge

CREATE TABLE trust_snapshots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL,
  execution_id      UUID NOT NULL REFERENCES agent_runs(id),
  agent_id          agent_id_type NOT NULL,
  action_type       TEXT NOT NULL,
  matrix_version    INTEGER NOT NULL,
  level             trust_level NOT NULL,
  score             SMALLINT NOT NULL,
  snapshot_hash     TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trust_snapshots_execution ON trust_snapshots(execution_id);
CREATE INDEX idx_trust_snapshots_workspace ON trust_snapshots(workspace_id, created_at DESC);
