-- Migration: Invoice data model (Epic 7, Story 7.1)
-- Purpose: invoices table, invoice_line_items table, workspace_invoice_sequences, generate_invoice_number function
-- Related: packages/db/src/schema/invoices.ts

-- ============================================
-- invoices table
-- ============================================
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'voided')),
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  total_cents BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  voided_at TIMESTAMPTZ,
  void_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Status transition: this story only allows draft -> voided
  -- Stories 7-2/7-3/7-4 add additional transitions via ALTER TABLE
  CONSTRAINT invoices_status_transition CHECK (
    status = 'draft'
    OR (status = 'voided')
  ),
  CONSTRAINT invoices_total_nonneg CHECK (total_cents >= 0)
);

CREATE UNIQUE INDEX idx_invoices_invoice_number ON invoices (workspace_id, invoice_number);
CREATE INDEX idx_invoices_workspace_client ON invoices (workspace_id, client_id);
CREATE INDEX idx_invoices_workspace_status ON invoices (workspace_id, status);

-- ============================================
-- invoice_line_items table
-- ============================================
CREATE TABLE invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL
    CHECK (source_type IN ('time_entry', 'fixed_service', 'retainer')),
  time_entry_id UUID REFERENCES time_entries(id) ON DELETE SET NULL,
  retainer_id UUID REFERENCES retainer_agreements(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL,
  unit_price_cents BIGINT NOT NULL DEFAULT 0,
  amount_cents BIGINT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ili_amount_nonneg CHECK (amount_cents >= 0),
  CONSTRAINT ili_quantity_pos CHECK (quantity > 0),
  CONSTRAINT ili_unit_price_nonneg CHECK (unit_price_cents >= 0),
  CONSTRAINT ili_source_fields CHECK (
    (source_type = 'time_entry' AND time_entry_id IS NOT NULL AND retainer_id IS NULL)
    OR (source_type = 'fixed_service' AND time_entry_id IS NULL AND retainer_id IS NULL)
    OR (source_type = 'retainer' AND retainer_id IS NOT NULL AND time_entry_id IS NULL)
    )
  );

-- ============================================
-- RLS: workspace_invoice_sequences
-- ============================================
ALTER TABLE workspace_invoice_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY policy_wis_select_member
  ON workspace_invoice_sequences FOR SELECT
  TO authenticated
  USING (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

CREATE POLICY policy_wis_all_member
  ON workspace_invoice_sequences FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

-- ============================================
-- Atomic RPC: create_invoice_with_items
-- ============================================
CREATE OR REPLACE FUNCTION create_invoice_with_items(
  p_workspace_id UUID,
  p_client_id UUID,
  p_invoice_number TEXT,
  p_issue_date DATE,
  p_due_date DATE,
  p_total_cents BIGINT,
  p_notes TEXT,
  p_created_by UUID,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_invoice_id UUID;
  v_item JSONB;
BEGIN
  INSERT INTO invoices (workspace_id, client_id, invoice_number, status, issue_date, due_date, total_cents, notes, created_by)
  VALUES (p_workspace_id, p_client_id, p_invoice_number, 'draft', p_issue_date, p_due_date, p_total_cents, p_notes, p_created_by)
  RETURNING id INTO v_invoice_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO invoice_line_items (invoice_id, workspace_id, source_type, time_entry_id, retainer_id, description, quantity, unit_price_cents, amount_cents, sort_order)
    VALUES (
      v_invoice_id,
      p_workspace_id,
      v_item->>'source_type',
      NULLIF(v_item->>'time_entry_id', '')::UUID,
      NULLIF(v_item->>'retainer_id', '')::UUID,
      v_item->>'description',
      (v_item->>'quantity')::NUMERIC(10,2),
      (v_item->>'unit_price_cents')::BIGINT,
      (v_item->>'amount_cents')::BIGINT,
      COALESCE((v_item->>'sort_order')::INT, 0)
    );
  END LOOP;

  RETURN v_invoice_id;
END;
$$;

-- ============================================
-- Atomic RPC: update_invoice_with_items
-- ============================================
CREATE OR REPLACE FUNCTION update_invoice_with_items(
  p_invoice_id UUID,
  p_workspace_id UUID,
  p_issue_date DATE DEFAULT NULL,
  p_due_date DATE DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_total_cents BIGINT DEFAULT NULL,
  p_items JSONB DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_items IS NOT NULL THEN
    DELETE FROM invoice_line_items WHERE invoice_id = p_invoice_id;

    INSERT INTO invoice_line_items (invoice_id, workspace_id, source_type, time_entry_id, retainer_id, description, quantity, unit_price_cents, amount_cents, sort_order)
    SELECT
      p_invoice_id,
      p_workspace_id,
      v->>'source_type',
      NULLIF(v->>'time_entry_id', '')::UUID,
      NULLIF(v->>'retainer_id', '')::UUID,
      v->>'description',
      (v->>'quantity')::NUMERIC(10,2),
      (v->>'unit_price_cents')::BIGINT,
      (v->>'amount_cents')::BIGINT,
      COALESCE((v->>'sort_order')::INT, 0)
    FROM jsonb_array_elements(p_items) v;
  END IF;

  UPDATE invoices SET
    issue_date = COALESCE(p_issue_date, issue_date),
    due_date = COALESCE(p_due_date, due_date),
    notes = COALESCE(p_notes, notes),
    total_cents = COALESCE(p_total_cents, total_cents),
    updated_at = now()
  WHERE id = p_invoice_id AND workspace_id = p_workspace_id AND status = 'draft';

  RETURN FOUND;
END;
$$;

CREATE INDEX idx_invoice_line_items_invoice_id ON invoice_line_items (invoice_id);
CREATE INDEX idx_invoice_line_items_time_entry_id ON invoice_line_items (time_entry_id) WHERE time_entry_id IS NOT NULL;
CREATE INDEX idx_invoice_line_items_workspace_id ON invoice_line_items (workspace_id);

-- ============================================
-- workspace_invoice_sequences table
-- ============================================
CREATE TABLE workspace_invoice_sequences (
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  year TEXT NOT NULL,
  last_number INT NOT NULL DEFAULT 0,
  PRIMARY KEY (workspace_id, year)
);

-- ============================================
-- generate_invoice_number function
-- ============================================
CREATE OR REPLACE FUNCTION generate_invoice_number(p_workspace_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_year TEXT := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  v_next_seq INT;
BEGIN
  INSERT INTO workspace_invoice_sequences (workspace_id, year, last_number)
  VALUES (p_workspace_id, v_year, 1)
  ON CONFLICT (workspace_id, year) DO UPDATE
    SET last_number = workspace_invoice_sequences.last_number + 1
  RETURNING last_number INTO v_next_seq;
  RETURN 'INV-' || v_year || '-' || LPAD(v_next_seq::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RLS: invoices
-- ============================================
-- NOTE: No DELETE policy on invoices table. Invoices are soft-deleted via
-- void status (status = 'voided'), not hard-deleted. This is intentional —
-- financial records must be preserved for audit trails.
-- If hard-delete is needed for admin/tooling, add a policy with a separate
-- discussion and approval.
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY policy_invoices_select_member
  ON invoices FOR SELECT
  TO authenticated
  USING (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

CREATE POLICY policy_invoices_insert_member
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

CREATE POLICY policy_invoices_update_member
  ON invoices FOR UPDATE
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

-- Client-scoped members see invoices for their assigned clients only
CREATE POLICY policy_invoices_select_client_scoped
  ON invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM member_client_access mca
      WHERE mca.workspace_id::text = invoices.workspace_id::text
        AND mca.user_id = auth.uid()
        AND mca.client_id = invoices.client_id
    )
  );

-- ============================================
-- RLS: invoice_line_items
-- ============================================
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY policy_ili_select_member
  ON invoice_line_items FOR SELECT
  TO authenticated
  USING (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

CREATE POLICY policy_ili_insert_member
  ON invoice_line_items FOR INSERT
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
      WHERE inv.id = invoice_line_items.invoice_id
        AND inv.workspace_id::text = invoice_line_items.workspace_id::text
    )
  );

CREATE POLICY policy_ili_update_member
  ON invoice_line_items FOR UPDATE
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

CREATE POLICY policy_ili_delete_member
  ON invoice_line_items FOR DELETE
  TO authenticated
  USING (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

-- Client-scoped members see line items for invoices of their assigned clients
CREATE POLICY policy_ili_select_client_scoped
  ON invoice_line_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices inv
      JOIN member_client_access mca
        ON mca.client_id = inv.client_id
      WHERE inv.id = invoice_line_items.invoice_id
        AND mca.workspace_id::text = invoice_line_items.workspace_id::text
        AND mca.user_id = auth.uid()
    )
  );
