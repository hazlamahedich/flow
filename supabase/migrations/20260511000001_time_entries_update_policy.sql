-- RLS UPDATE policies for time_entries
-- Story 5.3: Time Entry Editing & Invoice Impact Warnings
-- Drops old policies from 20260510000003 and replaces with corrected versions

-- Drop old UPDATE policies (from 20260510000003)
DROP POLICY IF EXISTS policy_time_entries_update_member ON time_entries;
DROP POLICY IF EXISTS policy_time_entries_update_admin ON time_entries;

-- Users can update own non-deleted time entries in their workspace
CREATE POLICY "Users can update own time entries"
  ON time_entries FOR UPDATE
  USING (
    workspace_id::text = (auth.jwt()->>'workspace_id')
    AND user_id = auth.uid()
    AND deleted_at IS NULL
  )
  WITH CHECK (
    workspace_id::text = (auth.jwt()->>'workspace_id')
    AND user_id = auth.uid()
  );

-- Admins/owners can update any entry in their workspace (active members only)
CREATE POLICY "Admins can update workspace time entries"
  ON time_entries FOR UPDATE
  USING (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
        AND wm.status = 'active'
    )
    AND deleted_at IS NULL
  )
  WITH CHECK (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
        AND wm.status = 'active'
    )
  );

-- Service role bypass (for agent operations from Epic 2)
CREATE POLICY "Service role can update time entries"
  ON time_entries FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);
