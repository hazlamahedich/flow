-- RLS policies for trust tables (trust_matrix, trust_transitions, trust_snapshots, trust_preconditions)
-- Related: Story 2.3 - Trust Matrix & Graduation System
-- Pattern: workspace_id::text = auth.jwt()->>'workspace_id'

ALTER TABLE trust_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_preconditions ENABLE ROW LEVEL SECURITY;

-- trust_matrix: owner/admin full CRUD, member SELECT, service_role full
CREATE POLICY policy_trust_matrix_select_member
  ON trust_matrix
  FOR SELECT
  TO authenticated
  USING (workspace_id::text = auth.jwt()->>'workspace_id');

CREATE POLICY policy_trust_matrix_insert_owner_admin
  ON trust_matrix
  FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND auth.jwt()->>'role' IN ('owner', 'admin')
  );

CREATE POLICY policy_trust_matrix_update_owner_admin
  ON trust_matrix
  FOR UPDATE
  TO authenticated
  USING (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND auth.jwt()->>'role' IN ('owner', 'admin')
  )
  WITH CHECK (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND auth.jwt()->>'role' IN ('owner', 'admin')
  );

CREATE POLICY policy_trust_matrix_service_role
  ON trust_matrix
  TO service_role
  USING (true)
  WITH CHECK (true);

-- trust_transitions: all roles SELECT own tenant, service_role INSERT only. No UPDATE, no DELETE (immutable)
CREATE POLICY policy_trust_transitions_select_member
  ON trust_transitions
  FOR SELECT
  TO authenticated
  USING (workspace_id::text = auth.jwt()->>'workspace_id');

CREATE POLICY policy_trust_transitions_insert_service_role
  ON trust_transitions
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- trust_snapshots: all roles SELECT own tenant, service_role INSERT only. No UPDATE, no DELETE (immutable)
CREATE POLICY policy_trust_snapshots_select_member
  ON trust_snapshots
  FOR SELECT
  TO authenticated
  USING (workspace_id::text = auth.jwt()->>'workspace_id');

CREATE POLICY policy_trust_snapshots_insert_service_role
  ON trust_snapshots
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- trust_preconditions: owner/admin full CRUD, member SELECT, service_role full
CREATE POLICY policy_trust_preconditions_select_member
  ON trust_preconditions
  FOR SELECT
  TO authenticated
  USING (workspace_id::text = auth.jwt()->>'workspace_id');

CREATE POLICY policy_trust_preconditions_insert_owner_admin
  ON trust_preconditions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND auth.jwt()->>'role' IN ('owner', 'admin')
  );

CREATE POLICY policy_trust_preconditions_update_owner_admin
  ON trust_preconditions
  FOR UPDATE
  TO authenticated
  USING (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND auth.jwt()->>'role' IN ('owner', 'admin')
  )
  WITH CHECK (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND auth.jwt()->>'role' IN ('owner', 'admin')
  );

CREATE POLICY policy_trust_preconditions_delete_owner_admin
  ON trust_preconditions
  FOR DELETE
  TO authenticated
  USING (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND auth.jwt()->>'role' IN ('owner', 'admin')
  );

CREATE POLICY policy_trust_preconditions_service_role
  ON trust_preconditions
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 90-day retention for trust_snapshots via pg_cron nightly purge
-- Note: pg_cron extension must be enabled; schedule is set separately if available
-- SELECT cron.schedule('purge-trust-snapshots', '0 3 * * *', $$DELETE FROM trust_snapshots WHERE created_at < NOW() - INTERVAL '90 days'$$);
