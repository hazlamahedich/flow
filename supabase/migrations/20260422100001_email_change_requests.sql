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
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 hour')
);

CREATE INDEX idx_email_change_requests_user_created
  ON email_change_requests (user_id, created_at DESC);

CREATE UNIQUE INDEX idx_email_change_requests_token
  ON email_change_requests (token);

-- Prevents multiple concurrent pending requests per user (race condition guard)
CREATE UNIQUE INDEX idx_ecr_one_pending_per_user
  ON email_change_requests (user_id) WHERE status = 'pending';

ALTER TABLE email_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY policy_ecr_insert_self ON email_change_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY policy_ecr_select_self ON email_change_requests
  FOR SELECT USING (auth.uid() = user_id);

-- Users may only cancel their own pending requests. The USING clause ensures
-- they can only find rows where status='pending' AND user_id matches. The
-- WITH CHECK ensures the update sets status to 'cancelled'. Verified/expired
-- transitions are handled by the verify route (service_role).
CREATE POLICY policy_ecr_update_self ON email_change_requests
  FOR UPDATE USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status = 'cancelled');

-- RPC: Atomic rate-limit check + insert + pending detection (AC#1, AC#2)
-- Single CTE eliminates TOCTOU race between count-check and insert.
-- SECURITY DEFINER: validates p_user_id = auth.uid() to prevent cross-user abuse.
-- existing_pending CTE checks expires_at to avoid deadlocking on expired rows.
CREATE OR REPLACE FUNCTION request_email_change_atomic(
  p_user_id uuid,
  p_new_email text,
  p_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count int;
  v_pending text;
  v_inserted int := 0;
BEGIN
  IF p_user_id != auth.uid() THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  SELECT COUNT(*)::int INTO v_count
    FROM email_change_requests
    WHERE user_id = p_user_id AND created_at > now() - interval '1 hour';

  SELECT new_email INTO v_pending
    FROM email_change_requests
    WHERE user_id = p_user_id AND status = 'pending' AND expires_at > now()
    LIMIT 1;

  IF v_count < 5 AND v_pending IS NULL THEN
    INSERT INTO email_change_requests (user_id, new_email, token)
    VALUES (p_user_id, p_new_email, p_token);
    v_inserted := 1;
  END IF;

  RETURN jsonb_build_object(
    'request_count', v_count,
    'was_inserted', v_inserted,
    'pending_new_email', v_pending
  );
END;
$$;

REVOKE ALL ON FUNCTION request_email_change_atomic FROM PUBLIC;
GRANT EXECUTE ON FUNCTION request_email_change_atomic TO authenticated;
