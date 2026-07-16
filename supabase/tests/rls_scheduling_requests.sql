-- pgTAP RLS tests: scheduling_requests (TD2 from Epic 6 retrospective)
-- Purpose: Workspace isolation for scheduling requests table
-- Table: scheduling_requests
-- Policy names: policy_scheduling_requests_*

BEGIN;

CREATE OR REPLACE FUNCTION reset_role() RETURNS void AS $$
BEGIN
  EXECUTE 'RESET ROLE';
END;
$$ LANGUAGE plpgsql;

SELECT plan(10);

SET ROLE postgres;

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'sched-owner@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', '{}'),
  ('22222222-2222-2222-2222-222222222222', 'sched-member@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', '{}'),
  ('33333333-3333-3333-3333-333333333333', 'sched-outsider@test.com', '{"workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'sched-owner@test.com', 'SchedOwner'),
  ('22222222-2222-2222-2222-222222222222', 'sched-member@test.com', 'SchedMember'),
  ('33333333-3333-3333-3333-333333333333', 'sched-outsider@test.com', 'SchedOutsider')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspaces (id, name, slug) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Sched Workspace A', 'sched-ws-a'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Sched Workspace B', 'sched-ws-b')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role, status) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner', 'active'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'member', 'active'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 'owner', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO clients (id, workspace_id, name, email) VALUES
  ('c1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Sched Client A', 'sched-a@test.com'),
  ('c2222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Sched Client B', 'sched-b@test.com')
ON CONFLICT (id) DO NOTHING;

RESET ROLE;


-- Test 1: Unauthenticated cannot read scheduling_requests (RLS default-deny: 0 rows)
SET ROLE anon;
SELECT is(
  (SELECT count(*) FROM scheduling_requests),
  0::bigint,
  'Unauthenticated user sees 0 scheduling_requests'
);
SELECT reset_role();

-- Test 2: Unauthenticated cannot insert scheduling_requests
SET ROLE anon;
SELECT throws_ok(
  $$INSERT INTO scheduling_requests (workspace_id, client_id, source_type, request_type, requested_by, status) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', 'va_manual', 'book_new', '{"name": "VA"}', 'pending')$$,
  '42501'
);
SELECT reset_role();


-- Test 3: Owner can insert scheduling_requests
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SET ROLE authenticated;
SELECT lives_ok(
  $$INSERT INTO scheduling_requests (workspace_id, client_id, source_type, request_type, requested_by, status) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', 'va_manual', 'book_new', '{"name": "VA"}', 'pending')$$,
  'Owner can insert scheduling_requests'
);
SELECT reset_role();

-- Test 4: Owner can read own workspace scheduling_requests
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SET ROLE authenticated;
SELECT is(
  (SELECT count(*) FROM scheduling_requests WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1::bigint,
  'Owner can see own workspace scheduling_requests'
);
SELECT reset_role();

-- Test 5: Member can read own workspace scheduling_requests
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SET ROLE authenticated;
SELECT is(
  (SELECT count(*) FROM scheduling_requests WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1::bigint,
  'Member can see own workspace scheduling_requests'
);
SELECT reset_role();

-- Test 6: Outsider cannot read other workspace scheduling_requests
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', false);
SET ROLE authenticated;
SELECT is(
  (SELECT count(*) FROM scheduling_requests WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0::bigint,
  'Outsider cannot see other workspace scheduling_requests'
);
SELECT reset_role();

-- Test 7: Outsider cannot insert into other workspace
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', false);
SET ROLE authenticated;
SELECT throws_ok(
  $$INSERT INTO scheduling_requests (workspace_id, client_id, source_type, request_type, requested_by, status) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', 'va_manual', 'book_new', '{"name": "Evil"}', 'pending')$$,
  '42501'
);
SELECT reset_role();

-- Test 8: Owner can update scheduling_requests
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SET ROLE authenticated;
SELECT lives_ok(
  $$UPDATE scheduling_requests SET status = 'options_proposed' WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  'Owner can update scheduling_requests'
);
SELECT reset_role();

-- Test 9: Outsider cannot update other workspace scheduling_requests
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', false);
SET ROLE authenticated;
SELECT lives_ok(
  $$UPDATE scheduling_requests SET status = 'cancelled' WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'$$,
  'Outsider update on other workspace is silently no-op (RLS)'
);
SELECT reset_role();

-- Test 10: service_role can read all scheduling_requests
SET ROLE service_role;
SELECT is(
  (SELECT count(*) FROM scheduling_requests WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  1::bigint,
  'service_role can read all scheduling_requests'
);
RESET ROLE;


SELECT * FROM finish();
ROLLBACK;
