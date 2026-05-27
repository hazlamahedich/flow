-- Migration: Stripe Payment Failure Handling (Epic 7, Story 7.5)
-- Purpose: Create stripe_webhook_events and invoice_payment_attempts tables, add RLS policies
-- Related: packages/db/src/schema/invoices.ts, packages/types/src/invoice-payment.ts

-- ============================================
-- stripe_webhook_events table
-- ============================================
CREATE TABLE stripe_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  payload_json JSONB NOT NULL DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '72 hours'),

  CONSTRAINT swe_status_valid CHECK (status IN ('pending', 'processed', 'failed'))
);

CREATE INDEX idx_stripe_webhook_events_stripe_event_id ON stripe_webhook_events (stripe_event_id);
CREATE INDEX idx_stripe_webhook_events_expires_at ON stripe_webhook_events (expires_at);
CREATE INDEX idx_stripe_webhook_events_workspace_id ON stripe_webhook_events (workspace_id);

-- ============================================
-- invoice_payment_attempts table
-- ============================================
CREATE TABLE invoice_payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  stripe_event_id TEXT,
  attempt_type TEXT NOT NULL,
  status TEXT NOT NULL,
  error_code TEXT,
  error_message TEXT,
  amount_cents BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ipa_attempt_type_valid CHECK (attempt_type IN ('manual', 'stripe_checkout')),
  CONSTRAINT ipa_status_valid CHECK (status IN ('failed', 'succeeded', 'pending')),
  CONSTRAINT ipa_amount_nonneg CHECK (amount_cents >= 0)
);

CREATE INDEX idx_invoice_payment_attempts_invoice_id ON invoice_payment_attempts (invoice_id);
CREATE INDEX idx_invoice_payment_attempts_invoice_created_at ON invoice_payment_attempts (invoice_id, created_at DESC);
CREATE INDEX idx_invoice_payment_attempts_workspace_id ON invoice_payment_attempts (workspace_id);

-- ============================================
-- Auto-update processed_at trigger for stripe_webhook_events
-- ============================================
CREATE OR REPLACE FUNCTION update_stripe_webhook_events_processed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != 'pending' AND OLD.status = 'pending' THEN
    NEW.processed_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_stripe_webhook_events_processed_at
  BEFORE UPDATE ON stripe_webhook_events
  FOR EACH ROW
  EXECUTE FUNCTION update_stripe_webhook_events_processed_at();

-- ============================================
-- RLS: stripe_webhook_events
-- ============================================
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS by default. For authenticated queries:
-- workspace_id is nullable (derived from metadata during processing).
-- Only active workspace members can SELECT; no INSERT/UPDATE/DELETE from app code.
CREATE POLICY policy_stripe_webhook_events_select_member
  ON stripe_webhook_events FOR SELECT
  TO authenticated
  USING (
    workspace_id IS NOT NULL
    AND workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

-- ============================================
-- RLS: invoice_payment_attempts
-- ============================================
ALTER TABLE invoice_payment_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY policy_invoice_payment_attempts_select_member
  ON invoice_payment_attempts FOR SELECT
  TO authenticated
  USING (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

CREATE POLICY policy_invoice_payment_attempts_insert_member
  ON invoice_payment_attempts FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

-- No UPDATE or DELETE for invoice_payment_attempts — append-only financial records

-- ============================================
-- Scheduled cleanup job for expired webhook events
-- ============================================
-- pg-boss cron pattern: daily at 03:00 UTC
-- Note: pg-boss job registration is handled in application code (scheduler.ts).
-- This is just the SQL helper that the job will invoke.
CREATE OR REPLACE FUNCTION cleanup_expired_stripe_webhook_events()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM stripe_webhook_events WHERE expires_at < now() AND status IN ('processed', 'failed');
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
