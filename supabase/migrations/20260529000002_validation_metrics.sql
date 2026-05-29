-- Validation Metrics table for thesis tracking
-- Story 8.3: Client Health Agent & Usage Analytics

CREATE TABLE validation_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  metric_type text NOT NULL CHECK (metric_type IN ('agent_quality', 'trust_progression', 'consolidation_signal', 'monetization', 'autonomy_adoption')),
  value numeric NOT NULL,
  dimensions jsonb NOT NULL DEFAULT '{}',
  recorded_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_validation_metrics_workspace ON validation_metrics (workspace_id);
CREATE INDEX idx_validation_metrics_type ON validation_metrics (workspace_id, metric_type);
CREATE INDEX idx_validation_metrics_recorded ON validation_metrics (workspace_id, recorded_at DESC);
CREATE INDEX idx_validation_metrics_workspace_text ON validation_metrics ((workspace_id::text));

-- Enable RLS
ALTER TABLE validation_metrics ENABLE ROW LEVEL SECURITY;

-- RLS: Owner/Admin can SELECT their own workspace's metrics
CREATE POLICY "validation_metrics_select_members"
  ON validation_metrics FOR SELECT
  USING (workspace_id::text = auth.jwt()->>'workspace_id');

-- RLS: Only service_role can INSERT
CREATE POLICY "validation_metrics_insert_service"
  ON validation_metrics FOR INSERT
  TO service_role
  WITH CHECK (true);
