-- Migration: Add retainer_agreements table (Epic 3, Story 3.2)
-- Purpose: Retainer agreements with scope creep detection
-- Related: FR73a, FR73c, AC1-AC10

CREATE TABLE retainer_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('hourly_rate', 'flat_monthly', 'package_based')),
  hourly_rate_cents bigint CHECK (hourly_rate_cents IS NULL OR hourly_rate_cents > 0),
  monthly_fee_cents bigint CHECK (monthly_fee_cents IS NULL OR monthly_fee_cents > 0),
  monthly_hours_threshold numeric(10,2),
  package_hours numeric(10,2),
  package_name text,
  billing_period_days integer NOT NULL DEFAULT 30 CHECK (billing_period_days > 0 AND billing_period_days <= 365),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date CHECK (end_date IS NULL OR end_date > start_date),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired')),
  cancelled_at timestamptz,
  cancellation_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Only one active retainer per client at a time
CREATE UNIQUE INDEX idx_one_active_retainer_per_client
  ON retainer_agreements (client_id) WHERE status = 'active';

-- Workspace-scoped scope creep queries
CREATE INDEX idx_retainer_agreements_workspace_active
  ON retainer_agreements (workspace_id, client_id) WHERE status = 'active';

-- General queries
CREATE INDEX idx_retainer_agreements_client_status
  ON retainer_agreements (client_id, status);

-- Type-specific field validation
ALTER TABLE retainer_agreements ADD CONSTRAINT ra_type_fields_check CHECK (
  (type = 'hourly_rate' AND hourly_rate_cents IS NOT NULL AND monthly_fee_cents IS NULL AND package_hours IS NULL AND package_name IS NULL) OR
  (type = 'flat_monthly' AND monthly_fee_cents IS NOT NULL AND hourly_rate_cents IS NULL AND package_hours IS NULL AND package_name IS NULL) OR
  (type = 'package_based' AND package_hours IS NOT NULL AND package_name IS NOT NULL AND monthly_fee_cents IS NULL)
);

-- Cancelled retainers must have cancelled_at
ALTER TABLE retainer_agreements ADD CONSTRAINT ra_cancelled_at_check CHECK (
  (status = 'cancelled' AND cancelled_at IS NOT NULL) OR (status != 'cancelled')
);

-- Enable RLS
ALTER TABLE retainer_agreements ENABLE ROW LEVEL SECURITY;

-- Owner/Admin: SELECT, INSERT, UPDATE only (no DELETE — cancel only)
CREATE POLICY rls_retainer_agreements_owner_admin ON retainer_agreements
  FOR ALL TO authenticated
  USING (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = retainer_agreements.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
        AND wm.status = 'active'
    )
  )
  WITH CHECK (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = retainer_agreements.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
        AND wm.status = 'active'
    )
  );

-- Block DELETE for all authenticated users (cancel only, no hard delete)
CREATE POLICY rls_retainer_agreements_block_delete ON retainer_agreements
  FOR DELETE TO authenticated
  USING (false);

-- Member: SELECT only (scoped to client access)
CREATE POLICY rls_retainer_agreements_member_select ON retainer_agreements
  FOR SELECT TO authenticated
  USING (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = retainer_agreements.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
    AND EXISTS (
      SELECT 1 FROM member_client_access mca
      WHERE mca.client_id = retainer_agreements.client_id
        AND mca.user_id = auth.uid()
        AND mca.workspace_id = retainer_agreements.workspace_id
        AND mca.revoked_at IS NULL
    )
  );

-- service_role: full access
CREATE POLICY rls_retainer_agreements_service_role ON retainer_agreements
  FOR ALL TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- updated_at trigger
CREATE TRIGGER set_retainer_agreements_updated_at
  BEFORE UPDATE ON retainer_agreements
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime('updated_at');
