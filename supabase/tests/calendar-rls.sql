-- pgTAP RLS tests: Calendar tables (client_calendars, calendar_events)
-- Purpose: Workspace isolation for calendar integration (Epic 6)
-- Tables: client_calendars, calendar_events
-- Policy names: policy_client_calendars_*, policy_calendar_events_*

BEGIN;

CREATE OR REPLACE FUNCTION reset_role() RETURNS void AS $$
BEGIN
  EXECUTE 'RESET ROLE';
END;
$$ LANGUAGE plpgsql;

SELECT plan(20);

-- ============================================================
-- Setup (run as superuser to avoid RLS recursion)
-- ============================================================
SET ROLE postgres;

-- Create auth.users for test identities
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'calendar-owner@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', '{}'),
  ('22222222-2222-2222-2222-222222222222', 'calendar-member@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', '{}'),
  ('33333333-3333-3333-3333-333333333333', 'calendar-outsider@test.com', '{"workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', '{}')
ON CONFLICT (id) DO NOTHING;

-- Create users records
INSERT INTO users (id, email, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'calendar-owner@test.com', 'CalOwner'),
  ('22222222-2222-2222-2222-222222222222', 'calendar-member@test.com', 'CalMember'),
  ('33333333-3333-3333-3333-333333333333', 'calendar-outsider@test.com', 'CalOutsider')
ON CONFLICT (id) DO NOTHING;

-- Create workspaces
INSERT INTO workspaces (id, name, slug) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Calendar Workspace A', 'cal-ws-a'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Calendar Workspace B', 'cal-ws-b')
ON CONFLICT (id) DO NOTHING;

-- Create workspace_members
INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'member'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 'owner')
ON CONFLICT DO NOTHING;

-- Create clients for test data
INSERT INTO clients (id, workspace_id, name, email) VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Client A', 'client-a@test.com'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Client B', 'client-b@test.com')
ON CONFLICT (id) DO NOTHING;

RESET ROLE;


-- ============================================================
-- TABLE: client_calendars — Unauthenticated access
-- ============================================================

-- Test 1: Unauthenticated cannot read client_calendars
SELECT throws_ok(
  $$SELECT * FROM client_calendars$$,
  '42501',
  'Unauthenticated user cannot read client_calendars'
);

-- Test 2: Unauthenticated cannot insert client_calendars
SELECT throws_ok(
  $$INSERT INTO client_calendars (workspace_id, client_id, calendar_id, calendar_name, access_type) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'cal-1@test.com', 'Test Calendar', 'read_only')$$,
  '42501',
  'Unauthenticated user cannot insert client_calendars'
);


-- ============================================================
-- TABLE: client_calendars — Authenticated workspace member
-- ============================================================

-- Test 3: Owner can insert client_calendars
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SET ROLE authenticated;
SELECT lives_ok(
  $$INSERT INTO client_calendars (workspace_id, client_id, calendar_id, calendar_name, access_type, sync_status) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'cal-owner@test.com', 'Owner Calendar', 'read_only', 'connected')$$,
  'Owner can insert client_calendars'
);
SELECT reset_role();

-- Test 4: Owner can read own workspace client_calendars
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SET ROLE authenticated;
SELECT is(
  (SELECT count(*) FROM client_calendars WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1::bigint,
  'Owner can see own workspace client_calendars'
);
SELECT reset_role();

-- Test 5: Member can read own workspace client_calendars
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SET ROLE authenticated;
SELECT is(
  (SELECT count(*) FROM client_calendars WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1::bigint,
  'Member can see own workspace client_calendars'
);
SELECT reset_role();

-- Test 6: Member can insert client_calendars
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SET ROLE authenticated;
SELECT lives_ok(
  $$INSERT INTO client_calendars (workspace_id, client_id, calendar_id, calendar_name, access_type, sync_status) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'cal-member@test.com', 'Member Calendar', 'read_write', 'connected')$$,
  'Member can insert client_calendars'
);
SELECT reset_role();

-- Test 7: Owner can update client_calendars
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SET ROLE authenticated;
SELECT lives_ok(
  $$UPDATE client_calendars SET calendar_name = 'Updated Calendar' WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND calendar_id = 'cal-owner@test.com'$$,
  'Owner can update client_calendars'
);
SELECT reset_role();


-- ============================================================
-- TABLE: client_calendars — Cross-workspace isolation
-- ============================================================

-- Test 8: Outsider cannot read other workspace client_calendars
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', false);
SET ROLE authenticated;
SELECT is(
  (SELECT count(*) FROM client_calendars WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0::bigint,
  'Outsider cannot see other workspace client_calendars'
);
SELECT reset_role();


-- ============================================================
-- TABLE: calendar_events — Unauthenticated access
-- ============================================================

-- Test 9: Unauthenticated cannot read calendar_events
SELECT throws_ok(
  $$SELECT * FROM calendar_events$$,
  '42501',
  'Unauthenticated user cannot read calendar_events'
);

-- Test 10: Unauthenticated cannot insert calendar_events
SELECT throws_ok(
  $$INSERT INTO calendar_events (workspace_id, client_calendar_id, provider_event_id, title, start_at, end_at) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', (SELECT id FROM client_calendars WHERE calendar_id = 'cal-owner@test.com' LIMIT 1), 'evt-001', 'Test Event', now(), now() + interval '1 hour')$$,
  '42501',
  'Unauthenticated user cannot insert calendar_events'
);


-- ============================================================
-- TABLE: calendar_events — Authenticated workspace member CRUD
-- ============================================================

-- Test 11: Owner can insert calendar_events
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SET ROLE authenticated;
SELECT lives_ok(
  $$INSERT INTO calendar_events (workspace_id, client_calendar_id, client_id, provider_event_id, title, start_at, end_at, event_type, source) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', (SELECT id FROM client_calendars WHERE calendar_id = 'cal-owner@test.com' LIMIT 1), 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'evt-001', 'Team Meeting', now(), now() + interval '1 hour', 'meeting', 'client_created')$$,
  'Owner can insert calendar_events'
);
SELECT reset_role();

-- Test 12: Owner can read own workspace calendar_events
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SET ROLE authenticated;
SELECT is(
  (SELECT count(*) FROM calendar_events WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1::bigint,
  'Owner can see own workspace calendar_events'
);
SELECT reset_role();

-- Test 13: Member can read own workspace calendar_events
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SET ROLE authenticated;
SELECT is(
  (SELECT count(*) FROM calendar_events WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1::bigint,
  'Member can see own workspace calendar_events'
);
SELECT reset_role();

-- Test 14: Member can insert calendar_events
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SET ROLE authenticated;
SELECT lives_ok(
  $$INSERT INTO calendar_events (workspace_id, client_calendar_id, provider_event_id, title, start_at, end_at, event_type, source) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', (SELECT id FROM client_calendars WHERE calendar_id = 'cal-member@test.com' LIMIT 1), 'evt-002', 'Focus Block', now(), now() + interval '2 hours', 'focus_block', 'client_created')$$,
  'Member can insert calendar_events'
);
SELECT reset_role();

-- Test 15: Owner can update calendar_events
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SET ROLE authenticated;
SELECT lives_ok(
  $$UPDATE calendar_events SET title = 'Updated Meeting' WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND provider_event_id = 'evt-001'$$,
  'Owner can update calendar_events'
);
SELECT reset_role();


-- ============================================================
-- TABLE: calendar_events — Cross-workspace isolation
-- ============================================================

-- Test 16: Outsider cannot read other workspace calendar_events
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', false);
SET ROLE authenticated;
SELECT is(
  (SELECT count(*) FROM calendar_events WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0::bigint,
  'Outsider cannot see other workspace calendar_events'
);
SELECT reset_role();


-- ============================================================
-- TABLE: client_calendars — service_role bypass
-- ============================================================

-- Test 17: service_role can read all client_calendars
SET ROLE service_role;
SELECT is(
  (SELECT count(*) FROM client_calendars WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  2::bigint,
  'service_role can read all client_calendars'
);
RESET ROLE;


-- ============================================================
-- TABLE: calendar_events — service_role bypass
-- ============================================================

-- Test 18: service_role can read all calendar_events
SET ROLE service_role;
SELECT is(
  (SELECT count(*) FROM calendar_events WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  2::bigint,
  'service_role can read all calendar_events'
);
RESET ROLE;

-- Test 19: service_role can insert client_calendars
SET ROLE service_role;
SELECT lives_ok(
  $$INSERT INTO client_calendars (workspace_id, client_id, calendar_id, calendar_name, access_type, sync_status) VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'cal-svc@test.com', 'Service Calendar', 'owner', 'connected')$$,
  'service_role can insert client_calendars'
);
RESET ROLE;

-- Test 20: service_role can insert calendar_events
SET ROLE service_role;
SELECT lives_ok(
  $$INSERT INTO calendar_events (workspace_id, client_calendar_id, provider_event_id, title, start_at, end_at, event_type, source) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', (SELECT id FROM client_calendars WHERE calendar_id = 'cal-owner@test.com' LIMIT 1), 'evt-svc-001', 'Service Event', now(), now() + interval '1 hour', 'unknown', 'auto_generated')$$,
  'service_role can insert calendar_events'
);
RESET ROLE;


SELECT * FROM finish();
ROLLBACK;
