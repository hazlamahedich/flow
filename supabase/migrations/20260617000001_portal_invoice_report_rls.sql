-- Migration: Portal cross-table RLS + invoice checkout columns + report feedback columns
-- Story 9.2: Client Portal Invoice Payment & Report Approval
-- Purpose: Schema changes and portal role SELECT-only RLS on invoices/invoice_line_items/
--          invoice_payments/weekly_reports/weekly_report_sections.
-- Related: FR51 (invoice viewing), FR52 (pay invoice), FR53 (report approval), FR54 (strict isolation), FR82 (notifications)
--
-- Prerequisites: 20260615000001_portal_tokens.sql (portal role + verify_portal_token pattern)
--                20260604000001_weekly_reports_stalled_highlights.sql (rejected status)
--
-- Notes:
--   * Portal role is read-only by design. Mutations go through SECURITY DEFINER RPCs
--     (see 20260617000002_portal_invoice_report_rpcs.sql).
--   * ::text cast on client_id/workspace_id JWT comparisons (project-context.md:118).
--   * No service_role key in the Node/Next layer for portal paths.

-- ============================================================
-- STEP 1: Invoice checkout columns
-- ============================================================

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS payment_url_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text;

-- Unique index on stripe_checkout_session_id for reconciliation (partial — nulls excluded)
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_stripe_checkout_session_id
  ON invoices (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

-- ============================================================
-- STEP 2: Weekly report feedback columns
-- ============================================================

ALTER TABLE weekly_reports
  ADD COLUMN IF NOT EXISTS client_feedback text,
  ADD COLUMN IF NOT EXISTS feedback_at timestamptz;

-- ============================================================
-- STEP 3: Client notification logs table
-- ============================================================

CREATE TABLE IF NOT EXISTS client_notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}',
  provider_message_id text,
  status text NOT NULL DEFAULT 'pending',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE client_notification_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_client_notification_logs_client
  ON client_notification_logs (client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_client_notification_logs_workspace
  ON client_notification_logs (workspace_id, created_at DESC);

-- Workspace-side RLS on notification logs (Owner/Admin/Member read, system insert via RPC)
CREATE POLICY rls_client_notification_logs_select_member ON client_notification_logs
  FOR SELECT TO authenticated
  USING (
    workspace_id::text IN (
      SELECT wm.workspace_id::text FROM workspace_members wm
      WHERE wm.user_id = auth.uid() AND wm.status = 'active'
    )
  );

-- Portal read access is gated by the write path (insert via SECURITY DEFINER RPC); no direct portal SELECT policy.

-- ============================================================
-- STEP 4: Portal role SELECT RLS on invoices
-- ============================================================
-- Portal role can only read invoices for the JWT client_id where the portal
-- token is valid (unexpired, unrevoked, used) and the client is not archived.
-- draft/voided invoices are additionally hidden at the query layer (AC2),
-- but RLS here allows all non-draft statuses for defense-in-depth.

CREATE POLICY rls_invoices_portal_select ON invoices
  FOR SELECT TO portal
  USING (
    client_id::text = (auth.jwt()->>'client_id')
    AND status IN ('sent', 'viewed', 'partially_paid', 'paid', 'overdue')
    AND EXISTS (
      SELECT 1 FROM portal_tokens pt
      WHERE pt.id::text = (auth.jwt()->>'portal_token_id')
        AND pt.client_id = invoices.client_id
        AND pt.workspace_id = invoices.workspace_id
        AND pt.revoked_at IS NULL
        AND pt.used_at IS NOT NULL
        AND pt.expires_at > now()
    )
    AND EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = invoices.client_id
        AND c.archived_at IS NULL
    )
  );

GRANT SELECT ON invoices TO portal;

-- ============================================================
-- STEP 5: Portal role SELECT RLS on invoice_line_items
-- ============================================================

CREATE POLICY rls_invoice_line_items_portal_select ON invoice_line_items
  FOR SELECT TO portal
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_line_items.invoice_id
        AND invoices.client_id::text = (auth.jwt()->>'client_id')
        AND invoices.status IN ('sent', 'viewed', 'partially_paid', 'paid', 'overdue')
    )
    AND EXISTS (
      SELECT 1 FROM portal_tokens pt
      WHERE pt.id::text = (auth.jwt()->>'portal_token_id')
        AND pt.workspace_id = invoice_line_items.workspace_id
        AND pt.client_id::text = (auth.jwt()->>'client_id')
        AND pt.revoked_at IS NULL
        AND pt.used_at IS NOT NULL
        AND pt.expires_at > now()
    )
    AND EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id::text = (auth.jwt()->>'client_id')
        AND c.archived_at IS NULL
    )
  );

GRANT SELECT ON invoice_line_items TO portal;

-- ============================================================
-- STEP 6: Portal role SELECT RLS on invoice_payments
-- ============================================================

CREATE POLICY rls_invoice_payments_portal_select ON invoice_payments
  FOR SELECT TO portal
  USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE invoices.id = invoice_payments.invoice_id
        AND invoices.client_id::text = (auth.jwt()->>'client_id')
        AND invoices.status IN ('sent', 'viewed', 'partially_paid', 'paid', 'overdue')
    )
    AND EXISTS (
      SELECT 1 FROM portal_tokens pt
      WHERE pt.id::text = (auth.jwt()->>'portal_token_id')
        AND pt.workspace_id = invoice_payments.workspace_id
        AND pt.client_id::text = (auth.jwt()->>'client_id')
        AND pt.revoked_at IS NULL
        AND pt.used_at IS NOT NULL
        AND pt.expires_at > now()
    )
    AND EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id::text = (auth.jwt()->>'client_id')
        AND c.archived_at IS NULL
    )
  );

GRANT SELECT ON invoice_payments TO portal;

-- ============================================================
-- STEP 7: Portal role SELECT RLS on weekly_reports
-- ============================================================

CREATE POLICY rls_weekly_reports_portal_select ON weekly_reports
  FOR SELECT TO portal
  USING (
    client_id::text = (auth.jwt()->>'client_id')
    AND EXISTS (
      SELECT 1 FROM portal_tokens pt
      WHERE pt.id::text = (auth.jwt()->>'portal_token_id')
        AND pt.client_id = weekly_reports.client_id
        AND pt.workspace_id = weekly_reports.workspace_id
        AND pt.revoked_at IS NULL
        AND pt.used_at IS NOT NULL
        AND pt.expires_at > now()
    )
    AND EXISTS (
      SELECT 1 FROM clients c
      WHERE c.id = weekly_reports.client_id
        AND c.archived_at IS NULL
    )
  );

GRANT SELECT ON weekly_reports TO portal;

-- ============================================================
-- STEP 8: Portal role SELECT RLS on weekly_report_sections
-- ============================================================
-- weekly_report_sections does not have workspace_id; derive it via the
-- parent weekly_reports row. The token workspace match is checked against
-- weekly_reports.workspace_id instead.

CREATE POLICY rls_weekly_report_sections_portal_select ON weekly_report_sections
  FOR SELECT TO portal
  USING (
    EXISTS (
      SELECT 1 FROM weekly_reports wr
      WHERE wr.id = weekly_report_sections.report_id
        AND wr.client_id::text = (auth.jwt()->>'client_id')
        AND wr.workspace_id::text = (auth.jwt()->>'workspace_id')
        AND EXISTS (
          SELECT 1 FROM portal_tokens pt
          WHERE pt.id::text = (auth.jwt()->>'portal_token_id')
            AND pt.workspace_id = wr.workspace_id
            AND pt.client_id::text = (auth.jwt()->>'client_id')
            AND pt.revoked_at IS NULL
            AND pt.used_at IS NOT NULL
            AND pt.expires_at > now()
        )
        AND EXISTS (
          SELECT 1 FROM clients c
          WHERE c.id::text = (auth.jwt()->>'client_id')
            AND c.archived_at IS NULL
        )
    )
  );

GRANT SELECT ON weekly_report_sections TO portal;
