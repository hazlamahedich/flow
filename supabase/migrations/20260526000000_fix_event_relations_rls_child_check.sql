-- Migration: Fix RLS for calendar_event_relations child_event_id workspace check
-- Fix: Story 6-4 code review patch — SELECT and DELETE policies only validated
-- parent_event_id workspace, not child_event_id, allowing cross-workspace data leaks

-- Fix SELECT policy to validate BOTH parent and child event workspaces
DROP POLICY IF EXISTS policy_cal_event_relations_select_member ON calendar_event_relations;
CREATE POLICY policy_cal_event_relations_select_member
  ON calendar_event_relations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM calendar_events ce
      INNER JOIN workspace_members wm ON wm.workspace_id = ce.workspace_id
      WHERE ce.id = calendar_event_relations.parent_event_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
    AND EXISTS (
      SELECT 1 FROM calendar_events ce2
      INNER JOIN workspace_members wm2 ON wm2.workspace_id = ce2.workspace_id
      WHERE ce2.id = calendar_event_relations.child_event_id
        AND wm2.user_id = auth.uid()
        AND wm2.status = 'active'
    )
  );

-- Fix DELETE policy to validate BOTH parent and child event workspaces
DROP POLICY IF EXISTS policy_cal_event_relations_delete_member ON calendar_event_relations;
CREATE POLICY policy_cal_event_relations_delete_member
  ON calendar_event_relations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM calendar_events ce
      INNER JOIN workspace_members wm ON wm.workspace_id = ce.workspace_id
      WHERE ce.id = calendar_event_relations.parent_event_id
        AND wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
    AND EXISTS (
      SELECT 1 FROM calendar_events ce2
      INNER JOIN workspace_members wm2 ON wm2.workspace_id = ce2.workspace_id
      WHERE ce2.id = calendar_event_relations.child_event_id
        AND wm2.user_id = auth.uid()
        AND wm2.status = 'active'
    )
  );
