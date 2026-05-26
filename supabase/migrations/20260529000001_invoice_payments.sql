-- Migration: Invoice payments & balance tracking (Epic 7, Story 7.3)
-- Purpose: Create invoice_payments table, add amount_paid_cents/credit_balance_cents/version to invoices,
--          create idempotency_keys table for payment idempotency, add RLS policies
-- Related: packages/db/src/schema/invoices.ts, packages/types/src/invoice.ts

-- ============================================
-- invoices table extensions
-- ============================================
ALTER TABLE invoices
  ADD COLUMN amount_paid_cents BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN credit_balance_cents BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_amount_paid_nonneg CHECK (amount_paid_cents >= 0),
  ADD CONSTRAINT invoices_credit_balance_nonneg CHECK (credit_balance_cents >= 0);

-- ============================================
-- invoice_payments table
-- ============================================
CREATE TABLE invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  amount_cents BIGINT NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL
    CHECK (payment_method IN ('stripe', 'manual_check', 'manual_bank_transfer', 'manual_cash', 'manual_other')),
  payment_date DATE NOT NULL,
  notes TEXT,
  stripe_payment_intent_id TEXT UNIQUE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ip_amount_nonneg CHECK (amount_cents > 0),
  CONSTRAINT ip_notes_length CHECK (length(notes) <= 1000)
);

CREATE INDEX idx_invoice_payments_invoice_id ON invoice_payments (invoice_id);
CREATE INDEX idx_invoice_payments_workspace_id ON invoice_payments (workspace_id);
CREATE INDEX idx_invoice_payments_stripe_pi ON invoice_payments (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;

-- ============================================
-- idempotency_keys table
-- ============================================
CREATE TABLE idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash TEXT NOT NULL,
  scope TEXT NOT NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  response_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE (key_hash, scope)
);

CREATE INDEX idx_idempotency_keys_scope ON idempotency_keys (scope);
CREATE INDEX idx_idempotency_keys_expires ON idempotency_keys (expires_at);

-- ============================================
-- Auto-update updated_at trigger
-- ============================================
CREATE TRIGGER set_invoice_payments_updated_at
  BEFORE UPDATE ON invoice_payments
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);

-- ============================================
-- RLS: invoice_payments
-- ============================================
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY policy_invoice_payments_select_member
  ON invoice_payments FOR SELECT
  TO authenticated
  USING (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

CREATE POLICY policy_invoice_payments_insert_member
  ON invoice_payments FOR INSERT
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
      WHERE inv.id = invoice_payments.invoice_id
        AND inv.workspace_id::text = invoice_payments.workspace_id::text
    )
  );

-- No UPDATE or DELETE for invoice_payments — append-only financial records

-- Client-scoped members see payments for invoices they have access to
CREATE POLICY policy_invoice_payments_select_client_scoped
  ON invoice_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices inv
      JOIN member_client_access mca
        ON mca.client_id = inv.client_id
      WHERE inv.id = invoice_payments.invoice_id
        AND mca.workspace_id::text = invoice_payments.workspace_id::text
        AND mca.user_id = auth.uid()
    )
  );

-- ============================================
-- RLS: idempotency_keys
-- ============================================
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY policy_idempotency_keys_select_member
  ON idempotency_keys FOR SELECT
  TO authenticated
  USING (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

CREATE POLICY policy_idempotency_keys_insert_member
  ON idempotency_keys FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

-- idempotency_keys is only accessed via service_role in server-side code
-- No member-facing SELECT directly; action layer handles lookups via RPC/service_role

-- ============================================
-- RPC: record_payment_with_concurrency
-- ============================================
CREATE OR REPLACE FUNCTION record_payment_with_concurrency(
  p_invoice_id UUID,
  p_workspace_id UUID,
  p_amount_cents BIGINT,
  p_payment_method TEXT,
  p_payment_date DATE,
  p_notes TEXT DEFAULT NULL,
  p_stripe_payment_intent_id TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_invoice RECORD;
  v_new_status TEXT;
  v_new_amount_paid BIGINT;
  v_new_credit_balance BIGINT;
  v_payment_id UUID;
BEGIN
  SELECT id, total_cents, amount_paid_cents, credit_balance_cents, status, version
    INTO v_invoice
    FROM invoices
    WHERE id = p_invoice_id AND workspace_id = p_workspace_id
    FOR UPDATE;

  IF v_invoice IS NULL THEN
    RETURN jsonb_build_object('error', 'NOT_FOUND');
  END IF;

  IF v_invoice.status = 'voided' THEN
    RETURN jsonb_build_object('error', 'INVOICE_VOIDED');
  END IF;

  IF v_invoice.status = 'paid' THEN
    RETURN jsonb_build_object('error', 'INVOICE_ALREADY_PAID');
  END IF;

  IF v_invoice.status = 'draft' THEN
    RETURN jsonb_build_object('error', 'INVOICE_DRAFT');
  END IF;

  IF p_amount_cents <= 0 THEN
    RETURN jsonb_build_object('error', 'INVALID_AMOUNT');
  END IF;

  v_new_amount_paid := v_invoice.amount_paid_cents + p_amount_cents;

  -- Compute new status
  IF v_new_amount_paid >= v_invoice.total_cents THEN
    v_new_status := 'paid';
    v_new_credit_balance := v_new_amount_paid - v_invoice.total_cents;
  ELSE
    v_new_status := 'partially_paid';
    v_new_credit_balance := 0;
  END IF;

  INSERT INTO invoice_payments (invoice_id, workspace_id, amount_cents, payment_method, payment_date, notes, stripe_payment_intent_id, created_by)
  VALUES (p_invoice_id, p_workspace_id, p_amount_cents, p_payment_method, p_payment_date, p_notes, p_stripe_payment_intent_id, p_created_by)
  RETURNING id INTO v_payment_id;

  UPDATE invoices SET
    amount_paid_cents = v_new_amount_paid,
    credit_balance_cents = v_new_credit_balance,
    status = v_new_status,
    version = version + 1,
    updated_at = now()
  WHERE id = p_invoice_id AND workspace_id = p_workspace_id;

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'new_status', v_new_status,
    'amount_paid_cents', v_new_amount_paid,
    'credit_balance_cents', v_new_credit_balance
  );
END;
$$;

-- ============================================
-- Cleanup cron for idempotency_keys
-- ============================================
-- Note: In production, pg-boss schedules the cleanup. This function is called by the cron job handler.
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM idempotency_keys WHERE expires_at < now();
END;
$$;

-- ============================================
-- CHECK constraint: invoice status valid values
-- Note: Status transition logic is enforced at the application layer.
-- This constraint only validates that the status column contains a known value.
-- ============================================
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_transition;
ALTER TABLE invoices ADD CONSTRAINT invoices_status_transition CHECK (
  status IN ('draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'voided')
);

-- ============================================
-- RLS: invoices — allow UPDATE status transitions for payment recording
-- The UPDATE policy already exists; no change needed (app layer controls transitions)
-- ============================================
