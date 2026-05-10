-- Migration: Create timer_state table and stop_timer RPC
-- Purpose: Support persistent sidebar timer (Story 5.2).
--   1. timer_state: one active timer per user per workspace (unique constraint).
--   2. stop_timer RPC: atomically inserts a time_entries row and deletes the
--      timer_state row in a single transaction. Uses SECURITY DEFINER so the
--      DELETE bypasses RLS (user cannot delete their own timer_state via the
--      normal DELETE policy — the RPC handles authorization internally).
-- Depends: 20260510000001_create_projects_table.sql
--          20260510000002_evolve_time_entries.sql
--          20260510000003_fix_rls_policies.sql

-- ============================================================
-- timer_state table
-- ============================================================

CREATE TABLE timer_state (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id       uuid NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  project_id      uuid REFERENCES projects(id) ON DELETE SET NULL,
  notes           text,
  started_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT timer_state_unique_user_per_workspace UNIQUE (workspace_id, user_id)
);

CREATE INDEX idx_timer_state_workspace_user ON timer_state(workspace_id, user_id);

ALTER TABLE timer_state ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS policies (mirrors the time_entries two-tier pattern)
-- ============================================================

-- SELECT: owner/admin sees all within workspace; member sees only own rows.
CREATE POLICY policy_timer_state_select_owner_admin ON timer_state
  FOR SELECT TO authenticated
  USING (
    workspace_id::text = (auth.jwt()->>'workspace_id')
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = timer_state.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
        AND wm.status = 'active'
    )
  );

CREATE POLICY policy_timer_state_select_member ON timer_state
  FOR SELECT TO authenticated
  USING (
    workspace_id::text = (auth.jwt()->>'workspace_id')
    AND user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = timer_state.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'member'
        AND wm.status = 'active'
    )
  );

-- INSERT: all authenticated roles. Member must have member_client_access
-- for the client_id (same pattern as policy_time_entries_insert_member).
CREATE POLICY policy_timer_state_insert_owner_admin ON timer_state
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id::text = (auth.jwt()->>'workspace_id')
    AND user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = timer_state.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
        AND wm.status = 'active'
    )
  );

CREATE POLICY policy_timer_state_insert_member ON timer_state
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id::text = (auth.jwt()->>'workspace_id')
    AND user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = timer_state.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role = 'member'
        AND wm.status = 'active'
    )
    AND EXISTS (
      SELECT 1 FROM member_client_access mca
      WHERE mca.client_id    = timer_state.client_id
        AND mca.workspace_id = timer_state.workspace_id
        AND mca.user_id      = auth.uid()
        AND mca.revoked_at   IS NULL
    )
  );

-- UPDATE: user_id = auth.uid() only (for future heartbeat if added).
CREATE POLICY policy_timer_state_update_own ON timer_state
  FOR UPDATE TO authenticated
  USING (
    workspace_id::text = (auth.jwt()->>'workspace_id')
    AND user_id = auth.uid()
  )
  WITH CHECK (
    workspace_id::text = (auth.jwt()->>'workspace_id')
    AND user_id = auth.uid()
  );

-- DELETE: user_id = auth.uid() only.
-- Note: the stop_timer RPC uses SECURITY DEFINER and handles the DELETE
-- internally, bypassing RLS. This policy exists for direct API use.
CREATE POLICY policy_timer_state_delete_own ON timer_state
  FOR DELETE TO authenticated
  USING (
    workspace_id::text = (auth.jwt()->>'workspace_id')
    AND user_id = auth.uid()
  );

-- ============================================================
-- stop_timer RPC
-- ============================================================

CREATE OR REPLACE FUNCTION stop_timer(
  p_timer_id     uuid,
  p_workspace_id uuid,
  p_user_id      uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_timer  public.timer_state;
  v_dur    integer;
  v_entry  public.time_entries;
BEGIN
  -- Prevent BOLA: caller must be the timer owner
  IF p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  -- Lock and read the timer row
  SELECT * INTO v_timer
    FROM public.timer_state
   WHERE id = p_timer_id
     AND workspace_id = p_workspace_id
     AND user_id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'TIMER_NOT_FOUND');
  END IF;

  -- Calculate duration (minimum 1 minute)
  v_dur := GREATEST(1, ROUND(EXTRACT(EPOCH FROM (now() - v_timer.started_at)) / 60)::integer);

  -- Insert time entry
  INSERT INTO public.time_entries (workspace_id, client_id, user_id, project_id, date, duration_minutes, notes)
    VALUES (
      v_timer.workspace_id,
      v_timer.client_id,
      v_timer.user_id,
      v_timer.project_id,
      (v_timer.started_at AT TIME ZONE 'UTC')::date,
      v_dur,
      v_timer.notes
    )
    RETURNING * INTO v_entry;

  -- Delete timer state
  DELETE FROM public.timer_state WHERE id = v_timer.id;

  RETURN jsonb_build_object(
    'timeEntryId', v_entry.id,
    'durationMinutes', v_dur
  );
END;
$$;

REVOKE ALL ON FUNCTION stop_timer(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION stop_timer(uuid, uuid, uuid) TO authenticated;
