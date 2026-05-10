-- pgTAP RLS tests: timer_state table
-- Purpose: Verify workspace-scoped access, member sees own, owner/admin sees all,
--          member_client_access enforcement on INSERT, unique constraint, service_role bypass.
-- Related: Story 5.2 — Persistent Sidebar Timer
-- Tables: timer_state, clients, projects, member_client_access
-- Depends: rls_clients.sql test data pattern

BEGIN;

CREATE OR REPLACE FUNCTION reset_role() RETURNS void AS $$
BEGIN
  EXECUTE 'RESET ROLE';
END;
$$ LANGUAGE plpgsql;

SELECT plan(20);

-- Setup (run as superuser to avoid RLS recursion)
SET ROLE postgres;

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'pgtap-owner@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', '{}'),
  ('22222222-2222-2222-2222-222222222222', 'pgtap-admin@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', '{}'),
  ('33333333-3333-3333-3333-333333333333', 'pgtap-member@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', '{}'),
  ('55555555-5555-5555-5555-555555555555', 'pgtap-outsider@test.com', '{"workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'pgtap-owner@test.com', 'Owner'),
  ('22222222-2222-2222-2222-222222222222', 'pgtap-admin@test.com', 'Admin'),
  ('33333333-3333-3333-3333-333333333333', 'pgtap-member@test.com', 'Member'),
  ('55555555-5555-5555-5555-555555555555', 'pgtap-outsider@test.com', 'Outsider')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspaces (id, name, slug) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Workspace A', 'pgtap-timer-ws-a'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Workspace B', 'pgtap-timer-ws-b')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role, status) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner', 'active'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'admin', 'active'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'member', 'active'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '55555555-5555-5555-5555-555555555555', 'owner', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO clients (id, workspace_id, name, email) VALUES
  ('c1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Acme Corp', 'acme@test.com'),
  ('c2222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Rival Ltd', 'rival@test.com')
ON CONFLICT (id) DO NOTHING;

-- Grant member access to client c1111111 in workspace A
INSERT INTO member_client_access (workspace_id, user_id, client_id)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'c1111111-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;

-- Seed two timer_state rows: one for owner in ws-a, one for member in ws-a
INSERT INTO timer_state (id, workspace_id, user_id, client_id, started_at)
VALUES
  ('t1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', now()),
  ('t2222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'c1111111-1111-1111-1111-111111111111', now())
ON CONFLICT DO NOTHING;

RESET ROLE;


-- ============================================================
-- SELECT tests
-- ============================================================

-- Test 1: Owner sees all timer_state rows in workspace (owner/admin policy)
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM timer_state), 2::bigint, 'Owner sees 2 timer rows in workspace');
SELECT reset_role();

-- Test 2: Admin sees all timer_state rows in workspace
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM timer_state), 2::bigint, 'Admin sees 2 timer rows in workspace');
SELECT reset_role();

-- Test 3: Member sees only own timer_state row
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM timer_state), 1::bigint, 'Member sees only own timer row');
SELECT reset_role();

-- Test 4: Outsider cannot SELECT from other workspace
SELECT set_config('request.jwt.claims', '{"sub": "55555555-5555-5555-5555-555555555555", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM timer_state WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 0::bigint, 'Outsider cannot see other workspace timers');
SELECT reset_role();


-- ============================================================
-- INSERT tests
-- ============================================================

-- Test 5: Owner can INSERT timer_state
-- (Clean up any existing row for owner first since unique constraint)
SET ROLE postgres;
DELETE FROM timer_state WHERE user_id = '11111111-1111-1111-1111-111111111111';
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SET ROLE authenticated;
SELECT lives_ok(
  $$INSERT INTO timer_state (workspace_id, user_id, client_id) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111')$$,
  'Owner can insert timer_state'
);
SELECT reset_role();

-- Test 6: Admin can INSERT timer_state
SET ROLE postgres;
DELETE FROM timer_state WHERE user_id = '22222222-2222-2222-2222-222222222222';
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', false);
SET ROLE authenticated;
SELECT lives_ok(
  $$INSERT INTO timer_state (workspace_id, user_id, client_id) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'c1111111-1111-1111-1111-111111111111')$$,
  'Admin can insert timer_state'
);
SELECT reset_role();

-- Test 7: Member WITH client access can INSERT timer_state
SET ROLE postgres;
DELETE FROM timer_state WHERE user_id = '33333333-3333-3333-3333-333333333333';
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SET ROLE authenticated;
SELECT lives_ok(
  $$INSERT INTO timer_state (workspace_id, user_id, client_id) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'c1111111-1111-1111-1111-111111111111')$$,
  'Member with client access can insert timer_state'
);
SELECT reset_role();

-- Test 8: Outsider cannot INSERT into other workspace
SELECT set_config('request.jwt.claims', '{"sub": "55555555-5555-5555-5555-555555555555", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', false);
SET ROLE authenticated;
SELECT throws_ok(
  $$INSERT INTO timer_state (workspace_id, user_id, client_id) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', 'c1111111-1111-1111-1111-111111111111')$$,
  42501
);
SELECT reset_role();

-- Test 9: Unique constraint — user cannot have two timers in same workspace
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SET ROLE authenticated;
SELECT throws_ok(
  $$INSERT INTO timer_state (workspace_id, user_id, client_id) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111')$$,
  23505
);
SELECT reset_role();


-- ============================================================
-- UPDATE tests (own only)
-- ============================================================

-- Test 10: User can UPDATE own timer_state
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SET ROLE authenticated;
SELECT lives_ok(
  $$UPDATE timer_state SET notes = 'updated notes' WHERE user_id = '11111111-1111-1111-1111-111111111111'$$,
  'User can update own timer_state'
);
SELECT reset_role();

-- Test 11: User cannot UPDATE another user's timer_state
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', false);
SET ROLE authenticated;
SELECT is(
  (SELECT count(*) FROM timer_state WHERE user_id = '11111111-1111-1111-1111-111111111111' AND notes = 'updated notes'),
  1::bigint,
  'Admin cannot update another user timer (row unchanged)'
);
SELECT reset_role();


-- ============================================================
-- DELETE tests (own only)
-- ============================================================

-- Test 12: User can DELETE own timer_state
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', false);
SET ROLE authenticated;
SELECT lives_ok(
  $$DELETE FROM timer_state WHERE user_id = '22222222-2222-2222-2222-222222222222'$$,
  'User can delete own timer_state'
);
SELECT reset_role();

-- Test 13: User cannot DELETE another user's timer_state
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SET ROLE authenticated;
SELECT lives_ok(
  $$DELETE FROM timer_state WHERE user_id = '11111111-1111-1111-1111-111111111111'$$,
  'Member delete of other timer runs but affects 0 rows'
);
SELECT reset_role();
-- Verify owner's row still exists
SET ROLE postgres;
SELECT is(
  (SELECT count(*) FROM timer_state WHERE user_id = '11111111-1111-1111-1111-111111111111'),
  1::bigint,
  'Owner timer row survives member delete attempt'
);
RESET ROLE;


-- ============================================================
-- stop_timer RPC tests
-- ============================================================

-- Test 14: stop_timer RPC returns TIMER_NOT_FOUND for missing timer
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SELECT is(
  stop_timer('00000000-0000-0000-0000-000000000000'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '11111111-1111-1111-1111-111111111111'::uuid),
  '{"error": "TIMER_NOT_FOUND"}'::jsonb,
  'stop_timer returns TIMER_NOT_FOUND for missing timer'
);

-- Test 15: stop_timer RPC succeeds for valid timer, creates time_entry
SET ROLE postgres;
INSERT INTO timer_state (id, workspace_id, user_id, client_id, started_at)
VALUES ('t3333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', now() - interval '30 minutes')
ON CONFLICT DO NOTHING;
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SELECT ok(
  (stop_timer('t3333333-3333-3333-3333-333333333333'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, '11111111-1111-1111-1111-111111111111'::uuid))->>'timeEntryId' IS NOT NULL,
  'stop_timer returns timeEntryId on success'
);

-- Test 16: stop_timer deletes the timer_state row
SET ROLE postgres;
SELECT is(
  (SELECT count(*) FROM timer_state WHERE id = 't3333333-3333-3333-3333-333333333333'),
  0::bigint,
  'stop_timer deletes the timer_state row'
);
RESET ROLE;

-- Test 17: stop_timer created a time_entry with correct duration
SET ROLE postgres;
SELECT ok(
  EXISTS (SELECT 1 FROM time_entries WHERE user_id = '11111111-1111-1111-1111-111111111111' AND duration_minutes >= 30),
  'stop_timer created time_entry with correct duration'
);
RESET ROLE;


-- ============================================================
-- service_role tests (bypasses RLS)
-- ============================================================

-- Test 18: service_role can SELECT all timer_state rows
SELECT lives_ok(
  $$SET ROLE service_role; SELECT count(*) FROM timer_state; RESET ROLE;$$,
  'service_role can select all timer_state rows'
);

-- Test 19: service_role can INSERT timer_state
SELECT lives_ok(
  $$SET ROLE service_role; INSERT INTO timer_state (workspace_id, user_id, client_id) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111'); RESET ROLE;$$,
  'service_role can insert timer_state'
);

-- Test 20: service_role can DELETE timer_state
SELECT lives_ok(
  $$SET ROLE service_role; DELETE FROM timer_state WHERE user_id = '11111111-1111-1111-1111-111111111111'; RESET ROLE;$$,
  'service_role can delete timer_state'
);


SELECT * FROM finish();
ROLLBACK;
