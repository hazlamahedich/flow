-- Migration: Enhance clients table for full CRUD (Epic 3, Story 3.1)
-- Purpose: Add company/billing fields, status/archival, role-aware RLS, indexes, trigger
-- Related: FR11-14, FR16, AC1-AC5

-- 1. Add new columns
ALTER TABLE clients
  ADD COLUMN company_name text,
  ADD COLUMN address text,
  ADD COLUMN notes text,
  ADD COLUMN billing_email text,
  ADD COLUMN hourly_rate_cents bigint,
  ADD COLUMN status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  ADD COLUMN archived_at timestamptz;

-- 2. Add CHECK constraint: archived status must pair with archived_at
ALTER TABLE clients
  ADD CONSTRAINT clients_status_archived_at_check
  CHECK ((status = 'archived' AND archived_at IS NOT NULL) OR (status = 'active' AND archived_at IS NULL));

-- 3. Drop existing permissive RLS policies
DROP POLICY IF EXISTS policy_clients_select_member ON clients;
DROP POLICY IF EXISTS policy_clients_insert_member ON clients;
DROP POLICY IF EXISTS policy_clients_update_member ON clients;

-- 4. Create role-aware RLS policies

-- Owner/Admin: full access to all clients in workspace (no DELETE — archive only)
CREATE POLICY rls_clients_owner_admin ON clients
  FOR ALL TO authenticated
  WITH CHECK (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = clients.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
        AND wm.status = 'active'
    )
  )
  USING (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = clients.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
        AND wm.status = 'active'
    )
  );

-- Member: read only assigned clients (via junction, non-revoked)
CREATE POLICY rls_clients_member_select ON clients
  FOR SELECT TO authenticated
  USING (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND EXISTS (
      SELECT 1 FROM member_client_access mca
      WHERE mca.client_id = clients.id
        AND mca.user_id = auth.uid()
        AND mca.workspace_id = clients.workspace_id
        AND mca.revoked_at IS NULL
    )
  );

-- 5. Add FK on junction table
ALTER TABLE member_client_access
  ADD CONSTRAINT fk_mca_client_id
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

-- 6. Add indexes
CREATE INDEX idx_clients_workspace_status ON clients (workspace_id, status);
CREATE INDEX idx_clients_workspace_name ON clients (workspace_id, name);

-- 8. Partial unique index on email per workspace (nullable email excluded)
CREATE UNIQUE INDEX idx_clients_workspace_email ON clients (workspace_id, LOWER(email)) WHERE email IS NOT NULL;

-- 9. Add updated_at trigger
CREATE TRIGGER set_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime('updated_at');
