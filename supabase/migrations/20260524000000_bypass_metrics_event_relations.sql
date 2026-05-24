-- Migration: Add calendar_bypass_metrics and calendar_event_relations tables (Epic 6, Story 6.4)
-- Purpose: Bypass detection metrics and cascade rescheduling event relations
-- Related: calendar-bypass-metrics.ts, calendar-event-relations.ts Drizzle schemas

-- ============================================================
-- Table: calendar_bypass_metrics
-- ============================================================

CREATE TABLE calendar_bypass_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  total_events INTEGER NOT NULL DEFAULT 0,
  bypass_count INTEGER NOT NULL DEFAULT 0,
  bypass_rate NUMERIC(5,4) NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, client_id, window_start)
);

CREATE INDEX idx_cal_bypass_metrics_workspace_window
  ON calendar_bypass_metrics (workspace_id, window_end);
CREATE INDEX idx_cal_bypass_metrics_workspace_client
  ON calendar_bypass_metrics (workspace_id, client_id);

ALTER TABLE calendar_bypass_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY policy_cal_bypass_metrics_select_member
  ON calendar_bypass_metrics FOR SELECT
  TO authenticated
  USING (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

CREATE POLICY policy_cal_bypass_metrics_insert_member
  ON calendar_bypass_metrics FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

CREATE POLICY policy_cal_bypass_metrics_update_member
  ON calendar_bypass_metrics FOR UPDATE
  TO authenticated
  USING (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

CREATE POLICY policy_cal_bypass_metrics_delete_member
  ON calendar_bypass_metrics FOR DELETE
  TO authenticated
  USING (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

CREATE POLICY policy_cal_bypass_metrics_service_role
  ON calendar_bypass_metrics FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER set_cal_bypass_metrics_updated_at
  BEFORE UPDATE ON calendar_bypass_metrics
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime('updated_at');

-- ============================================================
-- Table: calendar_event_relations
-- ============================================================

CREATE TABLE calendar_event_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_event_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  child_event_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL
    CHECK (relation_type IN ('prep_time', 'travel_time', 'debrief', 'rescheduled_from')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parent_event_id, child_event_id, relation_type)
);

CREATE INDEX idx_cal_event_relations_parent
  ON calendar_event_relations (parent_event_id);
CREATE INDEX idx_cal_event_relations_child
  ON calendar_event_relations (child_event_id);
CREATE INDEX idx_cal_event_relations_parent_type
  ON calendar_event_relations (parent_event_id, relation_type);

ALTER TABLE calendar_event_relations ENABLE ROW LEVEL SECURITY;

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
  );

CREATE POLICY policy_cal_event_relations_insert_member
  ON calendar_event_relations FOR INSERT
  TO authenticated
  WITH CHECK (
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
  );

CREATE POLICY policy_cal_event_relations_service_role
  ON calendar_event_relations FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
