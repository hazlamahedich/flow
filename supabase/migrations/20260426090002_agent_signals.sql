-- Agent signals table: immutable insert-only event records
-- Related: Story 2.1a - Agent Orchestrator Interface & Schema Foundation

CREATE TABLE agent_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id uuid NOT NULL,
  causation_id uuid NULL,
  agent_id agent_id_type NOT NULL,
  signal_type text NOT NULL CHECK (signal_type ~ '^[a-z-]+\.[a-z]+\.[a-z]+$'),
  version smallint NOT NULL DEFAULT 1,
  payload jsonb NOT NULL DEFAULT '{}',
  target_agent agent_id_type NULL,
  client_id uuid NULL,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_agent_signals_correlation_id ON agent_signals (correlation_id);
CREATE INDEX idx_agent_signals_workspace_created ON agent_signals (workspace_id, created_at);
CREATE INDEX idx_agent_signals_causation_id ON agent_signals (causation_id);
CREATE INDEX idx_agent_signals_agent_workspace ON agent_signals (workspace_id, agent_id);
CREATE INDEX idx_agent_signals_workspace ON agent_signals ((workspace_id::text));

-- Append-only enforcement: raise exception on UPDATE or DELETE
CREATE OR REPLACE FUNCTION fn_agent_signals_immutable()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'agent_signals table is append-only: % operations are not allowed', TG_OP;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_agent_signals_no_update
  BEFORE UPDATE ON agent_signals
  FOR EACH ROW EXECUTE FUNCTION fn_agent_signals_immutable();

CREATE TRIGGER trg_agent_signals_no_delete
  BEFORE DELETE ON agent_signals
  FOR EACH ROW EXECUTE FUNCTION fn_agent_signals_immutable();

-- Enable RLS
ALTER TABLE agent_signals ENABLE ROW LEVEL SECURITY;
