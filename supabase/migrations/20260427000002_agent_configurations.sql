-- Agent configurations table: per-workspace agent settings and lifecycle
-- Related: Story 2.2 - Agent Activation, Configuration & Scheduling

CREATE TABLE agent_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_id agent_id_type NOT NULL,
  status agent_status NOT NULL DEFAULT 'inactive',
  lifecycle_version integer NOT NULL DEFAULT 0,
  setup_completed boolean NOT NULL DEFAULT false,
  has_ever_been_activated boolean NOT NULL DEFAULT false,
  integration_health integration_health_type DEFAULT 'healthy',
  schedule jsonb NOT NULL DEFAULT '{}',
  trigger_config jsonb NOT NULL DEFAULT '{}',
  llm_preferences jsonb NOT NULL DEFAULT '{}',
  activated_at timestamptz NULL,
  deactivated_at timestamptz NULL,
  suspended_reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, agent_id),
  CONSTRAINT chk_schedule_object CHECK (jsonb_typeof(schedule) = 'object'),
  CONSTRAINT chk_trigger_config_object CHECK (jsonb_typeof(trigger_config) = 'object'),
  CONSTRAINT chk_llm_preferences_object CHECK (jsonb_typeof(llm_preferences) = 'object'),
  CONSTRAINT chk_setup_before_active CHECK (
    status NOT IN ('activating', 'active', 'draining') OR setup_completed = true
  )
);

CREATE INDEX idx_agent_configs_workspace ON agent_configurations(workspace_id);
CREATE INDEX idx_agent_configs_workspace_active ON agent_configurations(workspace_id) WHERE status = 'active';
CREATE INDEX idx_agent_configs_workspace_text ON agent_configurations((workspace_id::text));

-- updated_at trigger
CREATE OR REPLACE FUNCTION fn_agent_configurations_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_agent_configurations_updated_at
  BEFORE UPDATE ON agent_configurations
  FOR EACH ROW EXECUTE FUNCTION fn_agent_configurations_updated_at();

-- Enable RLS
ALTER TABLE agent_configurations ENABLE ROW LEVEL SECURITY;
