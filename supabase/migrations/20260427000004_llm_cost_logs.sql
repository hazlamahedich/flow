-- LLM cost logs table: immutable cost tracking per agent run
-- Related: Story 2.2 - Agent Activation, Configuration & Scheduling

CREATE TABLE llm_cost_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_id agent_id_type NOT NULL,
  run_id uuid NULL REFERENCES agent_runs(id),
  provider text NOT NULL,
  model text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  estimated_cost_cents integer NULL,
  actual_cost_cents integer NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cost_logs_workspace_date ON llm_cost_logs(workspace_id, created_at);
CREATE INDEX idx_cost_logs_workspace_agent ON llm_cost_logs(workspace_id, agent_id);
CREATE INDEX idx_cost_logs_workspace_text ON llm_cost_logs((workspace_id::text));

-- Enable RLS
ALTER TABLE llm_cost_logs ENABLE ROW LEVEL SECURITY;
