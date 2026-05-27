-- Migration: Credit notes (Epic 7, Story 7.4)
-- Purpose: Create credit_notes table, extend invoice_line_items.source_type CHECK, add RLS policies, add pgTAP tests
-- Related: packages/db/src/schema/invoices.ts, packages/types/src/invoice.ts

-- ============================================
-- credit_notes table
-- ============================================
CREATE TABLE credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  amount_cents BIGINT NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT cn_amount_nonneg CHECK (amount_cents >= 0),
  CONSTRAINT cn_reason_length CHECK (length(reason) >= 1 AND length(reason) <= 500)
);

CREATE INDEX idx_credit_notes_invoice_id ON credit_notes (invoice_id);
CREATE INDEX idx_credit_notes_workspace_id ON credit_notes (workspace_id);

-- Auto-update updated_at trigger
CREATE TRIGGER set_credit_notes_updated_at
  BEFORE UPDATE ON credit_notes
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime(updated_at);

-- ============================================
-- Extend invoice_line_items.source_type CHECK to include credit_note
-- ============================================
ALTER TABLE invoice_line_items
  DROP CONSTRAINT IF EXISTS ili_source_fields;

ALTER TABLE invoice_line_items
  ADD CONSTRAINT ili_source_fields CHECK (
    (source_type = 'time_entry' AND time_entry_id IS NOT NULL AND retainer_id IS NULL)
    OR (source_type = 'fixed_service' AND time_entry_id IS NULL AND retainer_id IS NULL)
    OR (source_type = 'retainer' AND retainer_id IS NOT NULL AND time_entry_id IS NULL)
    OR (source_type = 'credit_note' AND time_entry_id IS NULL AND retainer_id IS NULL)
  );

-- ============================================
-- RPC: void_invoice_and_clear_time_entries
-- Atomic operation: void invoice + clear time_entries.invoiced_at
-- ============================================
CREATE OR REPLACE FUNCTION void_invoice_and_clear_time_entries(
  p_invoice_id UUID,
  p_workspace_id UUID,
  p_void_reason TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_invoice RECORD;
  v_time_entry_ids UUID[];
BEGIN
  SELECT id, status, total_cents, amount_paid_cents
    INTO v_invoice
    FROM invoices
    WHERE id = p_invoice_id AND workspace_id = p_workspace_id
    FOR UPDATE;

  IF v_invoice IS NULL THEN
    RETURN jsonb_build_object('error', 'NOT_FOUND');
  END IF;

  IF v_invoice.status = 'voided' THEN
    RETURN jsonb_build_object(
      'success', true,
      'status', 'voided',
      'time_entries_cleared', 0,
      'prior_status', 'voided'
    );
  END IF;

  IF v_invoice.status = 'paid' THEN
    RETURN jsonb_build_object('error', 'INVOICE_PAID_CANNOT_VOID');
  END IF;

  -- Collect time entry IDs linked to this invoice
  SELECT array_agg(time_entry_id) INTO v_time_entry_ids
  FROM invoice_line_items
  WHERE invoice_id = p_invoice_id
    AND source_type = 'time_entry'
    AND time_entry_id IS NOT NULL;

  -- Clear invoiced_at for linked time entries
  IF v_time_entry_ids IS NOT NULL THEN
    UPDATE time_entries
    SET invoiced_at = NULL
    WHERE id = ANY(v_time_entry_ids)
      AND workspace_id = p_workspace_id;
  END IF;

  -- Void the invoice
  UPDATE invoices SET
    status = 'voided',
    voided_at = now(),
    void_reason = p_void_reason,
    credit_balance_cents = 0,
    updated_at = now()
  WHERE id = p_invoice_id AND workspace_id = p_workspace_id;

  RETURN jsonb_build_object(
    'success', true,
    'status', 'voided',
    'prior_status', v_invoice.status,
    'time_entries_cleared', COALESCE(array_length(v_time_entry_ids, 1), 0)
  );
END;
$$;

-- ============================================
-- RPC: issue_credit_note
-- Atomic operation: create credit_note + add negative line item + update credit_balance_cents
-- ============================================
CREATE OR REPLACE FUNCTION issue_credit_note(
  p_invoice_id UUID,
  p_workspace_id UUID,
  p_amount_cents BIGINT,
  p_reason TEXT,
  p_created_by UUID
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_invoice RECORD;
  v_credit_note_id UUID;
  v_new_credit_balance BIGINT;
  v_max_sort_order INT;
BEGIN
  SELECT id, status, total_cents, amount_paid_cents, credit_balance_cents
    INTO v_invoice
    FROM invoices
    WHERE id = p_invoice_id AND workspace_id = p_workspace_id
    FOR UPDATE;

  IF v_invoice IS NULL THEN
    RETURN jsonb_build_object('error', 'NOT_FOUND');
  END IF;

  IF v_invoice.status = 'paid' THEN
    RETURN jsonb_build_object('error', 'INVOICE_PAID_CANNOT_CREDIT');
  END IF;

  IF v_invoice.status = 'voided' THEN
    RETURN jsonb_build_object('error', 'INVOICE_VOIDED');
  END IF;

  IF p_amount_cents <= 0 THEN
    RETURN jsonb_build_object('error', 'INVALID_AMOUNT');
  END IF;

  IF p_amount_cents > (v_invoice.total_cents - v_invoice.amount_paid_cents - v_invoice.credit_balance_cents) THEN
    RETURN jsonb_build_object('error', 'CREDIT_EXCEEDS_BALANCE');
  END IF;

  -- Create credit note record
  INSERT INTO credit_notes (invoice_id, workspace_id, amount_cents, reason, created_by)
  VALUES (p_invoice_id, p_workspace_id, p_amount_cents, p_reason, p_created_by)
  RETURNING id INTO v_credit_note_id;

  -- Determine next sort_order
  SELECT COALESCE(MAX(sort_order), 0) INTO v_max_sort_order
  FROM invoice_line_items
  WHERE invoice_id = p_invoice_id;

  -- Add negative line item to preserve total invariant
  INSERT INTO invoice_line_items (
    invoice_id, workspace_id, source_type, description,
    quantity, unit_price_cents, amount_cents, sort_order
  ) VALUES (
    p_invoice_id, p_workspace_id, 'credit_note', p_reason,
    1, -p_amount_cents, -p_amount_cents, v_max_sort_order + 1
  );

  -- Update credit balance
  v_new_credit_balance := v_invoice.credit_balance_cents + p_amount_cents;

  UPDATE invoices SET
    credit_balance_cents = v_new_credit_balance,
    updated_at = now()
  WHERE id = p_invoice_id AND workspace_id = p_workspace_id;

  RETURN jsonb_build_object(
    'credit_note_id', v_credit_note_id,
    'new_credit_balance_cents', v_new_credit_balance,
    'line_item_sort_order', v_max_sort_order + 1
  );
END;
$$;

-- ============================================
-- RLS: credit_notes
-- ============================================
ALTER TABLE credit_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY policy_credit_notes_select_member
  ON credit_notes FOR SELECT
  TO authenticated
  USING (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

CREATE POLICY policy_credit_notes_insert_member
  ON credit_notes FOR INSERT
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
      WHERE inv.id = credit_notes.invoice_id
        AND inv.workspace_id::text = credit_notes.workspace_id::text
        AND inv.status NOT IN ('paid', 'voided')
    )
  );

-- No UPDATE or DELETE for credit_notes — append-only financial records

-- Client-scoped members see credit notes for invoices they have access to
CREATE POLICY policy_credit_notes_select_client_scoped
  ON credit_notes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices inv
      JOIN member_client_access mca
        ON mca.client_id = inv.client_id
      WHERE inv.id = credit_notes.invoice_id
        AND mca.workspace_id::text = credit_notes.workspace_id::text
        AND mca.user_id = auth.uid()
    )
  );
