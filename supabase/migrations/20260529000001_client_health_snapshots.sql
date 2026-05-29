-- Client Health Snapshots table for deterministic health scoring
-- Story 8.3: Client Health Agent & Usage Analytics

CREATE TABLE client_health_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL,
  engagement_score smallint NOT NULL CHECK (engagement_score >= 0 AND engagement_score <= 100),
  payment_score smallint NOT NULL CHECK (payment_score >= 0 AND payment_score <= 100),
  communication_score smallint NOT NULL CHECK (communication_score >= 0 AND communication_score <= 100),
  overall_health text NOT NULL CHECK (overall_health IN ('healthy', 'at-risk', 'critical', 'neutral', 'onboarding')),
  indicators jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_client_health_snapshot UNIQUE (client_id, snapshot_date)
);

-- Indexes
CREATE INDEX idx_client_health_snapshots_workspace ON client_health_snapshots (workspace_id);
CREATE INDEX idx_client_health_snapshots_workspace_date ON client_health_snapshots (workspace_id, snapshot_date DESC);
CREATE INDEX idx_client_health_snapshots_client ON client_health_snapshots (client_id);
CREATE INDEX idx_client_health_snapshots_health ON client_health_snapshots (workspace_id, overall_health);
CREATE INDEX idx_client_health_snapshots_workspace_text ON client_health_snapshots ((workspace_id::text));

-- Enable RLS
ALTER TABLE client_health_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS: Members can SELECT their own workspace's snapshots
CREATE POLICY "client_health_snapshots_select_members"
  ON client_health_snapshots FOR SELECT
  USING (workspace_id::text = auth.jwt()->>'workspace_id');

-- RLS: Only service_role can INSERT/UPDATE (agent execution)
CREATE POLICY "client_health_snapshots_insert_service"
  ON client_health_snapshots FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "client_health_snapshots_update_service"
  ON client_health_snapshots FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RPC: count of clients with at-risk or critical health (latest snapshot only)
-- Used by dashboard to surface clientHealthAlerts count.
CREATE OR REPLACE FUNCTION get_client_health_alert_count(p_workspace_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(DISTINCT client_id)
  FROM client_health_snapshots chs
  WHERE chs.workspace_id = p_workspace_id
    AND chs.snapshot_date = (
      SELECT MAX(chs2.snapshot_date)
      FROM client_health_snapshots chs2
      WHERE chs2.client_id = chs.client_id
        AND chs2.workspace_id = p_workspace_id
    )
    AND chs.overall_health IN ('at-risk', 'critical');
$$;

-- RPC: atomic upsert for health snapshot
CREATE OR REPLACE FUNCTION upsert_client_health_snapshot(
  p_workspace_id uuid,
  p_client_id uuid,
  p_snapshot_date date,
  p_engagement_score smallint,
  p_payment_score smallint,
  p_communication_score smallint,
  p_overall_health text,
  p_indicators jsonb
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO client_health_snapshots (
    workspace_id, client_id, snapshot_date,
    engagement_score, payment_score, communication_score,
    overall_health, indicators
  ) VALUES (
    p_workspace_id, p_client_id, p_snapshot_date,
    p_engagement_score, p_payment_score, p_communication_score,
    p_overall_health, p_indicators
  )
  ON CONFLICT (client_id, snapshot_date)
  DO UPDATE SET
    engagement_score = EXCLUDED.engagement_score,
    payment_score = EXCLUDED.payment_score,
    communication_score = EXCLUDED.communication_score,
    overall_health = EXCLUDED.overall_health,
    indicators = EXCLUDED.indicators
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
