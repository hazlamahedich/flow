-- RLS policies for agent_configurations
-- Related: Story 2.2 - Agent Activation, Configuration & Scheduling
-- Members SELECT own tenant, owner/admin INSERT/UPDATE, service_role full access, no DELETE

CREATE POLICY policy_agent_configurations_select_member
  ON agent_configurations
  FOR SELECT
  TO authenticated
  USING (workspace_id::text = auth.jwt()->>'workspace_id');

CREATE POLICY policy_agent_configurations_insert_owner_admin
  ON agent_configurations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND auth.jwt()->>'role' IN ('owner', 'admin')
  );

CREATE POLICY policy_agent_configurations_update_owner_admin
  ON agent_configurations
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

CREATE POLICY policy_agent_configurations_service_role
  ON agent_configurations
  TO service_role
  USING (true)
  WITH CHECK (true);
