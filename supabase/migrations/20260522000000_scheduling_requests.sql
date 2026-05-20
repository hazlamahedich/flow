-- Migration: Add scheduling_requests table (Epic 6, Story 6.3)
-- Purpose: Booking proposals and event creation pipeline
-- Related: scheduling_requests Drizzle schema

CREATE TABLE scheduling_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  source_email_id UUID REFERENCES emails(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL
    CHECK (source_type IN ('email_extraction', 'va_manual', 'client_portal')),
  request_type TEXT NOT NULL
    CHECK (request_type IN ('book_new', 'reschedule', 'cancel', 'check_availability')),
  requested_by JSONB NOT NULL,
  requested_slots JSONB,
  duration_minutes INTEGER,
  preferences JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL
    CHECK (status IN ('pending', 'options_proposed', 'option_selected', 'booked', 'failed', 'cancelled')),
  proposed_options JSONB NOT NULL DEFAULT '[]',
  selected_option INTEGER,
  booked_event_id UUID REFERENCES calendar_events(id) ON DELETE SET NULL,
  agent_run_id UUID REFERENCES agent_runs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  UNIQUE (workspace_id, source_email_id, request_type)
);

CREATE INDEX idx_scheduling_requests_workspace
  ON scheduling_requests (workspace_id);
CREATE INDEX idx_scheduling_requests_workspace_status
  ON scheduling_requests (workspace_id, status);
CREATE INDEX idx_scheduling_requests_client
  ON scheduling_requests (workspace_id, client_id);

CREATE UNIQUE INDEX uq_scheduling_requests_dedup_null_email
  ON scheduling_requests (workspace_id, request_type)
  WHERE source_email_id IS NULL;

ALTER TABLE scheduling_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY policy_scheduling_requests_select_member
  ON scheduling_requests FOR SELECT
  TO authenticated
  USING (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

CREATE POLICY policy_scheduling_requests_insert_member
  ON scheduling_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

CREATE POLICY policy_scheduling_requests_update_member
  ON scheduling_requests FOR UPDATE
  TO authenticated
  USING (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

CREATE POLICY policy_scheduling_requests_service_role
  ON scheduling_requests FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
