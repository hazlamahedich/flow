-- Auth configuration for magic link flow
-- Related: Story 1.3 - Magic Link Authentication

-- Allow auth module to create pending accounts via signInWithOtp
-- Supabase Auth handles this via enable_signup = true in config.toml

-- Add audit_log workspace_id nullable column for pre-workspace auth events
-- Auth events (magic_link_requested, rate_limit_triggered, etc.) happen before workspace context
ALTER TABLE audit_log ALTER COLUMN workspace_id DROP NOT NULL;

-- Create rate_limits table for serverless-safe rate limiting
CREATE TABLE rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  action text NOT NULL DEFAULT 'magic_link_request',
  request_count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  last_request_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_rate_limits_identifier_action ON rate_limits (identifier, action);
CREATE INDEX idx_rate_limits_window_start ON rate_limits (window_start);

-- RLS: service_role can write, anon denied, authenticated server-client read
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY policy_rate_limits_service_role_all ON rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY policy_rate_limits_authenticated_select ON rate_limits
  FOR SELECT
  TO authenticated
  USING (true);

-- Cleanup function for expired rate limit records
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limits WHERE window_start < now() - interval '2 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
