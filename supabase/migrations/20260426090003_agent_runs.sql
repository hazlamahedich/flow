-- Agent runs table: tracks execution lifecycle of agent tasks
-- Related: Story 2.1a - Agent Orchestrator Interface & Schema Foundation

CREATE TABLE agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_id agent_id_type NOT NULL,
  job_id text NOT NULL,
  signal_id uuid NULL REFERENCES agent_signals(id),
  action_type text NOT NULL,
  client_id uuid NULL,
  idempotency_key text UNIQUE NULL,
  status agent_run_status NOT NULL DEFAULT 'queued',
  input jsonb NOT NULL DEFAULT '{}',
  output jsonb NULL,
  error jsonb NULL,
  trust_tier_at_execution text NULL,
  correlation_id uuid NOT NULL,
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_agent_runs_workspace_status ON agent_runs (workspace_id, status);
CREATE INDEX idx_agent_runs_workspace_created ON agent_runs (workspace_id, created_at DESC);
CREATE UNIQUE INDEX idx_agent_runs_job_id ON agent_runs (job_id);
CREATE INDEX idx_agent_runs_correlation_id ON agent_runs (correlation_id);
CREATE INDEX idx_agent_runs_agent_workspace ON agent_runs (agent_id, workspace_id);
CREATE INDEX idx_agent_runs_idempotency ON agent_runs (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_agent_runs_workspace ON agent_runs ((workspace_id::text));

-- updated_at trigger
CREATE OR REPLACE FUNCTION fn_agent_runs_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_agent_runs_updated_at
  BEFORE UPDATE ON agent_runs
  FOR EACH ROW EXECUTE FUNCTION fn_agent_runs_updated_at();

-- Enable RLS
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
