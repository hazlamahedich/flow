-- Migration: email_change_requests table
-- Purpose: Track email change requests with rate limiting and atomic claim support
-- Related: Story 1.5a AC#1, AC#2, AC#4, AC#7
-- Note: User-scoped (not workspace-scoped). RLS: self-only access.

CREATE TABLE email_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  new_email text NOT NULL,
  token text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'verified', 'cancelled', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz GENERATED ALWAYS AS (created_at + interval '1 hour') STORED
);

CREATE INDEX idx_email_change_requests_user_created
  ON email_change_requests (user_id, created_at DESC);

CREATE UNIQUE INDEX idx_email_change_requests_token
  ON email_change_requests (token);

ALTER TABLE email_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY policy_ecr_insert_self ON email_change_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY policy_ecr_select_self ON email_change_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY policy_ecr_update_self ON email_change_requests
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RPC: Atomic rate-limit check + insert + pending detection (AC#1, AC#2)
-- Single CTE eliminates TOCTOU race between count-check and insert.
CREATE OR REPLACE FUNCTION request_email_change_atomic(
  p_user_id uuid,
  p_new_email text,
  p_token text
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $$
WITH current_count AS (
  SELECT COUNT(*) AS cnt FROM email_change_requests
  WHERE user_id = p_user_id AND created_at > now() - interval '1 hour'
),
existing_pending AS (
  SELECT new_email FROM email_change_requests
  WHERE user_id = p_user_id AND status = 'pending'
  LIMIT 1
),
inserted AS (
  INSERT INTO email_change_requests (user_id, new_email, token)
  SELECT p_user_id, p_new_email, p_token
  WHERE (SELECT cnt FROM current_count) < 5
    AND NOT EXISTS (SELECT 1 FROM existing_pending)
  RETURNING id
)
SELECT jsonb_build_object(
  'request_count', (SELECT cnt::int FROM current_count),
  'was_inserted', (SELECT COUNT(*)::int FROM inserted),
  'pending_new_email', (SELECT new_email FROM existing_pending)
);
$$;
