-- Migration: app_config table
-- Purpose: Global application config for tier limits, feature flags (FR91)
-- Related: Story 1.2 AC#6
-- Note: NOT workspace-scoped. Global config. Tier enforcement per-workspace deferred to Epic 9.

CREATE TABLE app_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY policy_app_config_select_authenticated ON app_config
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY policy_app_config_write_service_role ON app_config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER set_app_config_updated_at
  BEFORE UPDATE ON app_config
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime('updated_at');

INSERT INTO app_config (key, value) VALUES
  ('tier_limits', '{"free": {"maxWorkspaces": 1, "maxMembers": 3, "maxClients": 5}, "professional": {"maxWorkspaces": 3, "maxMembers": 10, "maxClients": 50}, "agency": {"maxWorkspaces": -1, "maxMembers": -1, "maxClients": -1}}'::jsonb),
  ('feature_flags', '{"free": {"agents": false, "reports": false}, "professional": {"agents": true, "reports": false}, "agency": {"agents": true, "reports": true}}'::jsonb),
  ('agent_config', '{"maxConcurrentRuns": 5, "defaultTimeoutMs": 30000, "retryLimit": 3}'::jsonb),
  ('billing_config', '{"currency": "usd", "trialDays": 14}'::jsonb);
