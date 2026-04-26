-- RLS Pattern Alignment + Milestone Type Constraint
-- Resolves: DW-2.6a-3 (RLS pattern inconsistency), DW-2.6a-5 (milestoneType enum)
-- Standardizes all trust/client-scoped RLS policies to ::text JWT cast pattern

-- ============================================================================
-- 1. Fix trust_audits RLS: replace subquery join with ::text JWT cast
-- ============================================================================

DROP POLICY IF EXISTS policy_trust_audits_select_member ON trust_audits;
DROP POLICY IF EXISTS policy_trust_audits_insert_member ON trust_audits;
DROP POLICY IF EXISTS policy_trust_audits_update_member ON trust_audits;
DROP POLICY IF EXISTS policy_trust_audits_delete_owner ON trust_audits;

CREATE POLICY policy_trust_audits_select_member ON trust_audits
  FOR SELECT TO authenticated
  USING (
    workspace_id::text IN (
      SELECT wm.workspace_id::text FROM workspace_members wm
      WHERE wm.user_id = auth.uid() AND wm.removed_at IS NULL
    )
  );

CREATE POLICY policy_trust_audits_insert_member ON trust_audits
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id::text IN (
      SELECT wm.workspace_id::text FROM workspace_members wm
      WHERE wm.user_id = auth.uid() AND wm.removed_at IS NULL
    )
  );

CREATE POLICY policy_trust_audits_update_member ON trust_audits
  FOR UPDATE TO authenticated
  USING (
    workspace_id::text IN (
      SELECT wm.workspace_id::text FROM workspace_members wm
      WHERE wm.user_id = auth.uid() AND wm.removed_at IS NULL
    )
  );

CREATE POLICY policy_trust_audits_delete_owner ON trust_audits
  FOR DELETE TO authenticated
  USING (
    workspace_id::text IN (
      SELECT wm.workspace_id::text FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.removed_at IS NULL
        AND wm.role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- 2. Fix trust_milestones RLS: replace subquery join with ::text JWT cast
-- ============================================================================

DROP POLICY IF EXISTS policy_trust_milestones_select_member ON trust_milestones;
DROP POLICY IF EXISTS policy_trust_milestones_insert_member ON trust_milestones;
DROP POLICY IF EXISTS policy_trust_milestones_update_member ON trust_milestones;
DROP POLICY IF EXISTS policy_trust_milestones_delete_owner ON trust_milestones;

CREATE POLICY policy_trust_milestones_select_member ON trust_milestones
  FOR SELECT TO authenticated
  USING (
    workspace_id::text IN (
      SELECT wm.workspace_id::text FROM workspace_members wm
      WHERE wm.user_id = auth.uid() AND wm.removed_at IS NULL
    )
  );

CREATE POLICY policy_trust_milestones_insert_member ON trust_milestones
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id::text IN (
      SELECT wm.workspace_id::text FROM workspace_members wm
      WHERE wm.user_id = auth.uid() AND wm.removed_at IS NULL
    )
  );

CREATE POLICY policy_trust_milestones_update_member ON trust_milestones
  FOR UPDATE TO authenticated
  USING (
    workspace_id::text IN (
      SELECT wm.workspace_id::text FROM workspace_members wm
      WHERE wm.user_id = auth.uid() AND wm.removed_at IS NULL
    )
  );

CREATE POLICY policy_trust_milestones_delete_owner ON trust_milestones
  FOR DELETE TO authenticated
  USING (
    workspace_id::text IN (
      SELECT wm.workspace_id::text FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.removed_at IS NULL
        AND wm.role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- 3. Fix agent_feedback RLS: replace subquery join with ::text JWT cast
-- ============================================================================

DROP POLICY IF EXISTS agent_feedback_select ON agent_feedback;
DROP POLICY IF EXISTS agent_feedback_insert ON agent_feedback;
DROP POLICY IF EXISTS agent_feedback_update ON agent_feedback;
DROP POLICY IF EXISTS agent_feedback_delete_owner_admin ON agent_feedback;

CREATE POLICY agent_feedback_select ON agent_feedback
  FOR SELECT TO authenticated
  USING (
    workspace_id::text IN (
      SELECT wm.workspace_id::text FROM workspace_members wm
      WHERE wm.user_id = auth.uid() AND wm.removed_at IS NULL
    )
  );

CREATE POLICY agent_feedback_insert ON agent_feedback
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND workspace_id::text IN (
      SELECT wm.workspace_id::text FROM workspace_members wm
      WHERE wm.user_id = auth.uid() AND wm.removed_at IS NULL
    )
  );

CREATE POLICY agent_feedback_update ON agent_feedback
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND workspace_id::text IN (
      SELECT wm.workspace_id::text FROM workspace_members wm
      WHERE wm.user_id = auth.uid() AND wm.removed_at IS NULL
    )
  );

CREATE POLICY agent_feedback_delete_owner_admin ON agent_feedback
  FOR DELETE TO authenticated
  USING (
    workspace_id::text IN (
      SELECT wm.workspace_id::text FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.removed_at IS NULL
        AND wm.role IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- 4. Add milestone_type CHECK constraint (DW-2.6a-5)
-- ============================================================================

ALTER TABLE trust_milestones
  ADD CONSTRAINT chk_milestone_type
  CHECK (milestone_type IN (
    'first_execution',
    'seven_consecutive',
    'twenty_executions',
    'score_threshold',
    'stick_time_30_days',
    'auto_approval',
    'manual_override'
  ));
