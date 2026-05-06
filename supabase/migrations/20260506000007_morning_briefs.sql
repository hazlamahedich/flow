-- Migration: Add morning_briefs table
-- Related Story: 4.3 Morning Brief Generation

CREATE TABLE morning_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  brief_date date NOT NULL DEFAULT CURRENT_DATE,
  content jsonb NOT NULL,
  generation_status text NOT NULL DEFAULT 'pending'
    CHECK (generation_status IN ('pending', 'generating', 'completed', 'failed')),
  error_message text,
  email_count_handled integer NOT NULL DEFAULT 0,
  email_count_attention integer NOT NULL DEFAULT 0,
  generated_at timestamptz NOT NULL DEFAULT now(),
  viewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, brief_date)
);

CREATE INDEX idx_morning_briefs_workspace_generated ON morning_briefs(workspace_id, generated_at DESC);
CREATE INDEX idx_morning_briefs_workspace_date ON morning_briefs(workspace_id, brief_date DESC);

ALTER TABLE morning_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "policy_morning_briefs_select_member"
  ON morning_briefs
  FOR SELECT
  TO authenticated
  USING (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.removed_at IS NULL
    )
  );

CREATE POLICY "policy_morning_briefs_service_all"
  ON morning_briefs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "policy_morning_briefs_update_viewed"
  ON morning_briefs
  FOR UPDATE
  TO authenticated
  USING (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.removed_at IS NULL
    )
  )
  WITH CHECK (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.removed_at IS NULL
    )
    AND generation_status IS NOT DISTINCT FROM generation_status
    AND content IS NOT DISTINCT FROM content
    AND brief_date IS NOT DISTINCT FROM brief_date
    AND workspace_id IS NOT DISTINCT FROM workspace_id
    AND email_count_handled IS NOT DISTINCT FROM email_count_handled
    AND email_count_attention IS NOT DISTINCT FROM email_count_attention
    AND error_message IS NOT DISTINCT FROM error_message
    AND generated_at IS NOT DISTINCT FROM generated_at
    AND created_at IS NOT DISTINCT FROM created_at
  );

CREATE OR REPLACE FUNCTION mark_brief_viewed(brief_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE morning_briefs
  SET viewed_at = now()
  WHERE id = brief_id
    AND workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.removed_at IS NULL
    );
END;
$$;
