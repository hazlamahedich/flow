-- RLS policies for llm_cost_logs
-- Related: Story 2.2 - Agent Activation, Configuration & Scheduling
-- Members SELECT own tenant, service_role INSERT only. No UPDATE, no DELETE (immutable).

CREATE POLICY policy_llm_cost_logs_select_member
  ON llm_cost_logs
  FOR SELECT
  TO authenticated
  USING (workspace_id::text = auth.jwt()->>'workspace_id');

CREATE POLICY policy_llm_cost_logs_insert_service
  ON llm_cost_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);
