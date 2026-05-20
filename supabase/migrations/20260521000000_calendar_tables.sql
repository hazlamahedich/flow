-- Migration: Add client_calendars and calendar_events tables (Epic 6, Story 6.1)
-- Purpose: Google Calendar OAuth connection and event sync
-- Related: client_calendars Drizzle schema, calendar_events Drizzle schema

-- ============================================================
-- Table: client_calendars
-- ============================================================

CREATE TABLE client_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'google_calendar'
    CHECK (provider IN ('google_calendar', 'outlook')),
  calendar_id TEXT NOT NULL,
  calendar_name TEXT NOT NULL,
  access_type TEXT NOT NULL DEFAULT 'read_only'
    CHECK (access_type IN ('owner', 'read_write', 'read_only')),
  oauth_state JSONB NOT NULL DEFAULT '{}',
  sync_cursor TEXT,
  sync_status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (sync_status IN ('connected', 'syncing', 'error', 'disconnected')),
  consecutive_refresh_failures INTEGER NOT NULL DEFAULT 0,
  color_tag TEXT,
  email_address TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, calendar_id)
);

-- Indexes
CREATE INDEX idx_client_calendars_workspace_client
  ON client_calendars (workspace_id, client_id);
CREATE INDEX idx_client_calendars_workspace
  ON client_calendars (workspace_id);
CREATE INDEX idx_client_calendars_workspace_calendar_id
  ON client_calendars (workspace_id, calendar_id);

-- RLS (canonical workspace_members pattern)
ALTER TABLE client_calendars ENABLE ROW LEVEL SECURITY;

CREATE POLICY policy_client_calendars_select_member
  ON client_calendars FOR SELECT
  TO authenticated
  USING (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

CREATE POLICY policy_client_calendars_insert_member
  ON client_calendars FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

CREATE POLICY policy_client_calendars_update_member
  ON client_calendars FOR UPDATE
  TO authenticated
  USING (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

CREATE POLICY policy_client_calendars_delete_member
  ON client_calendars FOR DELETE
  TO authenticated
  USING (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

-- Service role bypass
CREATE POLICY policy_client_calendars_service_role
  ON client_calendars FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Auto-update updated_at
CREATE TRIGGER set_client_calendars_updated_at
  BEFORE UPDATE ON client_calendars
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime('updated_at');

-- Atomic increment of consecutive_refresh_failures
-- Returns the new failure count, or -1 if the calendar was not found.
-- If the new count >= p_max_failures, also sets sync_status = 'disconnected'.
CREATE OR REPLACE FUNCTION increment_calendar_refresh_failures(
  p_calendar_id UUID,
  p_max_failures INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_count INTEGER;
BEGIN
  UPDATE client_calendars
  SET consecutive_refresh_failures = consecutive_refresh_failures + 1
  WHERE id = p_calendar_id
  RETURNING consecutive_refresh_failures INTO v_new_count;

  IF NOT FOUND THEN
    RETURN -1;
  END IF;

  IF v_new_count >= p_max_failures THEN
    UPDATE client_calendars
    SET sync_status = 'disconnected'
    WHERE id = p_calendar_id;
  END IF;

  RETURN v_new_count;
END;
$$;

-- ============================================================
-- Table: calendar_events
-- ============================================================

CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_calendar_id UUID NOT NULL REFERENCES client_calendars(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  provider_event_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  is_all_day BOOLEAN NOT NULL DEFAULT false,
  attendees JSONB NOT NULL DEFAULT '[]',
  event_type TEXT NOT NULL DEFAULT 'unknown'
    CHECK (event_type IN ('meeting', 'focus_block', 'travel', 'personal', 'deadline', 'unknown')),
  source TEXT NOT NULL DEFAULT 'unknown'
    CHECK (source IN ('va_created', 'client_created', 'third_party', 'auto_generated', 'unknown')),
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurring_rule TEXT,
  created_via TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (client_calendar_id, provider_event_id)
);

-- Conflict detection indexes (BOTH required per spec)
CREATE INDEX idx_calendar_events_time_range
  ON calendar_events (client_calendar_id, start_at, end_at);
CREATE INDEX idx_cal_events_conflicts
  ON calendar_events (workspace_id, start_at, end_at)
  WHERE end_at > now();
CREATE INDEX idx_calendar_events_workspace
  ON calendar_events (workspace_id);
CREATE INDEX idx_calendar_events_calendar_provider_id
  ON calendar_events (client_calendar_id, provider_event_id);

-- RLS (canonical workspace_members pattern)
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY policy_calendar_events_select_member
  ON calendar_events FOR SELECT
  TO authenticated
  USING (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

CREATE POLICY policy_calendar_events_insert_member
  ON calendar_events FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

CREATE POLICY policy_calendar_events_update_member
  ON calendar_events FOR UPDATE
  TO authenticated
  USING (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

CREATE POLICY policy_calendar_events_delete_member
  ON calendar_events FOR DELETE
  TO authenticated
  USING (
    workspace_id::text IN (
      SELECT wm.workspace_id::text
      FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

-- Service role bypass
CREATE POLICY policy_calendar_events_service_role
  ON calendar_events FOR ALL
  TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Auto-update updated_at
CREATE TRIGGER set_calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime('updated_at');
