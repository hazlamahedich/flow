-- RLS policies for agent_signals and agent_runs
-- Related: Story 2.1a - Agent Orchestrator Interface & Schema Foundation
--
-- agent_signals: members SELECT own tenant, service_role INSERT only, no UPDATE/DELETE
-- agent_runs: members SELECT own tenant, service_role INSERT/UPDATE, no DELETE

-- ============================================================
-- agent_signals policies
-- ============================================================

CREATE POLICY policy_agent_signals_select_member
  ON agent_signals
  FOR SELECT
  TO authenticated
  USING (workspace_id::text = auth.jwt()->>'workspace_id');

CREATE POLICY policy_agent_signals_insert_service
  ON agent_signals
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ============================================================
-- agent_runs policies
-- ============================================================

CREATE POLICY policy_agent_runs_select_member
  ON agent_runs
  FOR SELECT
  TO authenticated
  USING (workspace_id::text = auth.jwt()->>'workspace_id');

CREATE POLICY policy_agent_runs_insert_service
  ON agent_runs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY policy_agent_runs_update_service
  ON agent_runs
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);
