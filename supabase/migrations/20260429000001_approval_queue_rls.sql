-- Story 2.5: RLS policies for approval queue operations
-- SELECT: workspace members can view waiting_approval / timed_out runs
-- UPDATE: workspace members can approve/reject/resume/cancel within own workspace

CREATE POLICY policy_agent_runs_select_approval_member
  ON agent_runs
  FOR SELECT
  TO authenticated
  USING (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND status IN ('waiting_approval', 'timed_out')
  );

CREATE POLICY policy_agent_runs_update_member
  ON agent_runs
  FOR UPDATE
  TO authenticated
  USING (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND status IN ('waiting_approval', 'timed_out')
  )
  WITH CHECK (
    workspace_id::text = auth.jwt()->>'workspace_id'
  );
