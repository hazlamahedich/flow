-- Migration: Invoice delivery & payment link (Epic 7, Story 7.2)
-- Purpose: Extend invoices table with delivery columns, create invoice_deliveries table, RLS policies, token generation
-- Related: packages/db/src/schema/invoices.ts

-- ============================================
-- invoices table extensions
-- ============================================
ALTER TABLE invoices
  ADD COLUMN payment_url TEXT,
  ADD COLUMN sent_at TIMESTAMPTZ,
  ADD COLUMN viewed_at TIMESTAMPTZ,
  ADD COLUMN delivery_token TEXT UNIQUE;

-- Replace status constraint with value whitelist (transition logic in app layer)
-- TODO: Story 7-4 will add a transition trigger for directional enforcement
ALTER TABLE invoices DROP CONSTRAINT invoices_status_transition;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_valid CHECK (
  status IN ('draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'voided')
);

-- ============================================
-- invoice_deliveries table
-- ============================================
CREATE TABLE invoice_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
  sent_at TIMESTAMPTZ,
  retry_count INT NOT NULL DEFAULT 0,
  last_error TEXT,
  message_id TEXT,
  attempt_log JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoice_deliveries_invoice_id ON invoice_deliveries (invoice_id);
CREATE INDEX idx_invoice_deliveries_workspace_id ON invoice_deliveries (workspace_id);
CREATE INDEX idx_invoice_deliveries_status ON invoice_deliveries (status);

-- ============================================
-- RLS: invoice_deliveries
-- ============================================
ALTER TABLE invoice_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY policy_invoice_deliveries_select_member
  ON invoice_deliveries FOR SELECT
  TO authenticated
  USING (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

CREATE POLICY policy_invoice_deliveries_insert_member
  ON invoice_deliveries FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
    AND EXISTS (
      SELECT 1 FROM invoices inv
      WHERE inv.id = invoice_deliveries.invoice_id
        AND inv.workspace_id = invoice_deliveries.workspace_id
    )
  );

CREATE POLICY policy_invoice_deliveries_update_member
  ON invoice_deliveries FOR UPDATE
  TO authenticated
  USING (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  )
  WITH CHECK (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

-- ============================================
-- Delivery token generation function (HMAC-SHA256 via pgcrypto)
-- Requires pgcrypto extension (enabled by default in Supabase)
-- ============================================
CREATE OR REPLACE FUNCTION generate_delivery_token(
  p_invoice_id UUID,
  p_workspace_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_secret TEXT := current_setting('app.invoice_token_secret', true);
  v_payload TEXT;
  v_signature TEXT;
BEGIN
  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE EXCEPTION 'invoice_token_secret not configured';
  END IF;

  v_payload := p_invoice_id || ':' || p_workspace_id;
  v_signature := encode(hmac(v_payload, v_secret, 'sha256'), 'base64');
  RETURN encode(v_payload::bytea, 'base64') || '.' || v_signature;
END;
$$;

-- ============================================
-- Auto-update updated_at trigger
-- ============================================
CREATE TRIGGER set_invoice_deliveries_updated_at
  BEFORE UPDATE ON invoice_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);

-- ============================================
-- Optional: pg-boss job handler table already exists (from Epic 2)
-- ============================================
