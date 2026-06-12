-- time_entry_edit_history table for audit trail
-- Story 5.3: Time Entry Editing & Invoice Impact Warnings
-- Purpose: Audit trail for future invoice reconciliation (Epic 7)

CREATE TABLE time_entry_edit_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id uuid NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
  previous_values jsonb NOT NULL,
  changed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  edit_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_teeh_entry ON time_entry_edit_history (time_entry_id);
CREATE INDEX idx_teeh_changed_by ON time_entry_edit_history (changed_by);

ALTER TABLE time_entry_edit_history ENABLE ROW LEVEL SECURITY;

-- Members can insert edit history for entries in their workspace (changed_by must be self)
CREATE POLICY "Members can insert edit history in workspace"
  ON time_entry_edit_history FOR INSERT
  WITH CHECK (
    changed_by = auth.uid()
    AND time_entry_id IN (
      SELECT te.id
      FROM time_entries te
      WHERE te.workspace_id IN (
        SELECT wm.workspace_id
        FROM workspace_members wm
        WHERE wm.user_id = auth.uid()
          AND wm.status = 'active'
      )
    )
  );

-- Members can view edit history in their workspace (active members only)
CREATE POLICY "Members can view edit history in workspace"
  ON time_entry_edit_history FOR SELECT
  USING (
    time_entry_id IN (
      SELECT te.id
      FROM time_entries te
      WHERE te.workspace_id IN (
        SELECT wm.workspace_id
        FROM workspace_members wm
        WHERE wm.user_id = auth.uid()
          AND wm.status = 'active'
      )
    )
  );

-- Unauthenticated access denied
CREATE POLICY "Unauthenticated denied from edit history"
  ON time_entry_edit_history FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);
