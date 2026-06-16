-- Migration: Portal SECURITY DEFINER RPCs for mutations
-- Story 9.2: Client Portal Invoice Payment & Report Approval
-- Purpose: SECURITY DEFINER RPCs for portal mutations (approve report, request changes,
--          refresh checkout URL). Each RPC re-verifies the caller's portal JWT claims
--          and token validity inside Postgres before mutating any row.
-- Related: FR52 (pay invoice), FR53 (report approval), FR54 (strict isolation)
--
-- Prerequisites: 20260617000001_portal_invoice_report_rls.sql (schema + RLS)
--                20260615000001_portal_tokens.sql (portal role + token shape)
--
-- Notes:
--   * These RPCs bypass RLS (SECURITY DEFINER), so they must enforce identity and
--     token validity themselves. They are granted ONLY to the `portal` role, never anon.
--   * All functions read auth.jwt()->>'client_id' and auth.jwt()->>'portal_token_id'
--     and verify the token row in portal_tokens is valid and unexpired.
--   * ::text cast on client_id/workspace_id JWT comparisons (project-context.md:118).
--   * No service_role key in the Node/Next layer for portal paths.

-- ============================================================
-- STEP 1: Shared helper — verify_portal_jwt_identity
-- ============================================================
-- Returns the portal token record if the JWT claims are valid and the token is active.
-- Returns NULL if any check fails.

CREATE OR REPLACE FUNCTION verify_portal_jwt_identity()
RETURNS portal_tokens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_token portal_tokens;
  v_client_id text := auth.jwt()->>'client_id';
  v_token_id  text := auth.jwt()->>'portal_token_id';
BEGIN
  IF v_client_id IS NULL OR v_token_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT *
  INTO v_token
  FROM portal_tokens
  WHERE id::text = v_token_id
    AND client_id::text = v_client_id
    AND revoked_at IS NULL
    AND used_at IS NOT NULL
    AND expires_at > now();

  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION verify_portal_jwt_identity() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION verify_portal_jwt_identity() TO portal;

-- ============================================================
-- STEP 2: SECURITY DEFINER RPC — approve_report_via_portal
-- ============================================================

CREATE OR REPLACE FUNCTION approve_report_via_portal(
  p_report_id uuid,
  p_client_id uuid
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_token portal_tokens;
  v_report RECORD;
BEGIN
  v_token := verify_portal_jwt_identity();
  IF v_token IS NULL THEN
    RETURN 'FORBIDDEN';
  END IF;

  IF v_token.client_id::text != p_client_id::text THEN
    RETURN 'FORBIDDEN';
  END IF;

  SELECT client_id, status INTO v_report
  FROM weekly_reports
  WHERE id = p_report_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'NOT_FOUND';
  END IF;

  IF v_report.client_id::text != p_client_id::text THEN
    RETURN 'FORBIDDEN';
  END IF;

  IF v_report.status NOT IN ('sent', 'viewed') THEN
    RETURN 'INVALID_STATE';
  END IF;

  UPDATE weekly_reports
  SET status = 'approved', updated_at = now()
  WHERE id = p_report_id;

  IF NOT FOUND THEN
    RETURN 'NOT_FOUND';
  END IF;

  RETURN 'OK';
END;
$$;

REVOKE ALL ON FUNCTION approve_report_via_portal(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION approve_report_via_portal(uuid, uuid) TO portal;

-- ============================================================
-- STEP 3: SECURITY DEFINER RPC — request_report_changes_via_portal
-- ============================================================

CREATE OR REPLACE FUNCTION request_report_changes_via_portal(
  p_report_id uuid,
  p_client_id uuid,
  p_message text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_token portal_tokens;
  v_report RECORD;
BEGIN
  v_token := verify_portal_jwt_identity();
  IF v_token IS NULL THEN
    RETURN 'FORBIDDEN';
  END IF;

  IF v_token.client_id::text != p_client_id::text THEN
    RETURN 'FORBIDDEN';
  END IF;

  IF p_message IS NULL OR length(p_message) < 1 OR length(p_message) > 2000 THEN
    RETURN 'INVALID_MESSAGE';
  END IF;

  SELECT client_id, status INTO v_report
  FROM weekly_reports
  WHERE id = p_report_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'NOT_FOUND';
  END IF;

  IF v_report.client_id::text != p_client_id::text THEN
    RETURN 'FORBIDDEN';
  END IF;

  IF v_report.status NOT IN ('sent', 'viewed') THEN
    RETURN 'INVALID_STATE';
  END IF;

  UPDATE weekly_reports
  SET status = 'rejected',
      client_feedback = p_message,
      feedback_at = now(),
      updated_at = now()
  WHERE id = p_report_id;

  IF NOT FOUND THEN
    RETURN 'NOT_FOUND';
  END IF;

  RETURN 'OK';
END;
$$;

REVOKE ALL ON FUNCTION request_report_changes_via_portal(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION request_report_changes_via_portal(uuid, uuid, text) TO portal;

-- ============================================================
-- STEP 4: SECURITY DEFINER RPC — refresh_portal_checkout_url
-- ============================================================

CREATE OR REPLACE FUNCTION refresh_portal_checkout_url(
  p_invoice_id uuid,
  p_client_id uuid,
  p_checkout_url text,
  p_session_id text,
  p_expires_at timestamptz
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_token portal_tokens;
  v_invoice RECORD;
BEGIN
  v_token := verify_portal_jwt_identity();
  IF v_token IS NULL THEN
    RETURN 'FORBIDDEN';
  END IF;

  IF v_token.client_id::text != p_client_id::text THEN
    RETURN 'FORBIDDEN';
  END IF;

  IF p_checkout_url IS NULL OR length(p_checkout_url) < 1 OR length(p_checkout_url) > 2048 THEN
    RETURN 'INVALID_INPUT';
  END IF;

  IF p_session_id IS NULL OR length(p_session_id) < 1 OR length(p_session_id) > 255 THEN
    RETURN 'INVALID_INPUT';
  END IF;

  IF p_expires_at IS NULL OR p_expires_at <= now() THEN
    RETURN 'INVALID_INPUT';
  END IF;

  SELECT i.client_id, i.status, c.archived_at
  INTO v_invoice
  FROM invoices i
  JOIN clients c ON c.id = i.client_id
  WHERE i.id = p_invoice_id
  FOR UPDATE OF i;

  IF NOT FOUND THEN
    RETURN 'NOT_FOUND';
  END IF;

  IF v_invoice.client_id::text != p_client_id::text THEN
    RETURN 'FORBIDDEN';
  END IF;

  IF v_invoice.archived_at IS NOT NULL THEN
    RETURN 'FORBIDDEN';
  END IF;

  IF v_invoice.status NOT IN ('sent', 'viewed', 'partially_paid', 'overdue') THEN
    RETURN 'INVALID_STATE';
  END IF;

  UPDATE invoices
  SET payment_url = p_checkout_url,
      payment_url_expires_at = p_expires_at,
      stripe_checkout_session_id = p_session_id
  WHERE id = p_invoice_id;

  IF NOT FOUND THEN
    RETURN 'NOT_FOUND';
  END IF;

  RETURN 'OK';
EXCEPTION
  WHEN unique_violation THEN
    RETURN 'DUPLICATE_SESSION';
END;
$$;

REVOKE ALL ON FUNCTION refresh_portal_checkout_url(uuid, uuid, text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION refresh_portal_checkout_url(uuid, uuid, text, text, timestamptz) TO portal;

-- ============================================================
-- STEP 5: SECURITY DEFINER RPC — log_client_notification
-- ============================================================
-- Both portal and workspace-side actions write notification logs.
-- The table has RLS with no direct INSERT policy, so all inserts go through
-- this narrow, auditable RPC.

CREATE OR REPLACE FUNCTION log_client_notification(
  p_type text,
  p_client_id uuid,
  p_workspace_id uuid,
  p_payload jsonb,
  p_provider_message_id text,
  p_status text,
  p_error text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
BEGIN
  INSERT INTO client_notification_logs (
    type, client_id, workspace_id, payload, provider_message_id, status, error, created_at
  ) VALUES (
    p_type, p_client_id, p_workspace_id,
    COALESCE(p_payload, '{}'),
    NULLIF(p_provider_message_id, ''),
    COALESCE(p_status, 'pending'),
    p_error,
    now()
  );
END;
$$;

REVOKE ALL ON FUNCTION log_client_notification(text, uuid, uuid, jsonb, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION log_client_notification(text, uuid, uuid, jsonb, text, text, text) TO portal, authenticated;
