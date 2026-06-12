-- pgTAP RLS tests: time_entries SELECT and INSERT policies
-- Purpose: Verify SELECT scoping (workspace membership) and INSERT authorization
--          (workspace-scoped, cross-workspace denied, anonymous denied, service_role bypass).
-- Related: Epic 5 — Time Tracking
-- Tables: time_entries, clients, workspace_members

BEGIN;

SELECT plan(10);

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
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Workspace A', 'pgtap-te-si-ws-a'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Workspace B', 'pgtap-te-si-ws-b')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role, status) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner', 'active'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'admin', 'active'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'member', 'active'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '55555555-5555-5555-5555-555555555555', 'owner', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO clients (id, workspace_id, name, email) VALUES
  ('c1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Acme Corp', 'acme@test.com')
ON CONFLICT (id) DO NOTHING;

-- Grant member access to client so member can INSERT time entries
INSERT INTO member_client_access (workspace_id, user_id, client_id, granted_by) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;

-- Seed time entries
INSERT INTO time_entries (id, workspace_id, client_id, user_id, date, duration_minutes)
VALUES
  ('a0000001-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '2026-05-01', 60),
  ('a0000001-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', '2026-05-02', 90)
ON CONFLICT (id) DO NOTHING;

-- ============= SELECT TESTS =============

-- Test 1: Owner can see all entries in workspace
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}';

SELECT is(
  (SELECT count(*) FROM time_entries WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  2::bigint,
  'Owner can see all entries in workspace'
);

RESET ROLE;

-- Test 2: Admin can see all entries in workspace
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}';

SELECT is(
  (SELECT count(*) FROM time_entries WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  2::bigint,
  'Admin can see all entries in workspace'
);

RESET ROLE;

-- Test 3: Member can see all entries in workspace (RLS uses workspace_id only)
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}';

SELECT is(
  (SELECT count(*) FROM time_entries WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  2::bigint,
  'Member can see all entries in workspace (workspace-scoped RLS)'
);

RESET ROLE;

-- Test 4: Cross-workspace SELECT denied
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "55555555-5555-5555-5555-555555555555", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}';

SELECT is(
  (SELECT count(*) FROM time_entries WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0::bigint,
  'Cross-workspace SELECT denied'
);

RESET ROLE;

-- ============= INSERT TESTS =============

-- Test 5: Owner can insert entry in workspace
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}';

INSERT INTO time_entries (id, workspace_id, client_id, user_id, date, duration_minutes)
VALUES ('a0000001-0000-0000-0000-000000000010', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '2026-05-05', 30);
SELECT is(
  (SELECT count(*) FROM time_entries WHERE id = 'a0000001-0000-0000-0000-000000000010'),
  1::bigint,
  'Owner can insert entry in workspace'
);

RESET ROLE;

-- Test 6: Member can insert entry in workspace
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}';

INSERT INTO time_entries (id, workspace_id, client_id, user_id, date, duration_minutes)
VALUES ('a0000001-0000-0000-0000-000000000011', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', '2026-05-06', 45);
SELECT is(
  (SELECT count(*) FROM time_entries WHERE id = 'a0000001-0000-0000-0000-000000000011'),
  1::bigint,
  'Member can insert own entry in workspace'
);

RESET ROLE;

-- Test 7: Cross-workspace INSERT denied
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "55555555-5555-5555-5555-555555555555", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}';

SELECT throws_ok(
  $$INSERT INTO time_entries (id, workspace_id, client_id, user_id, date, duration_minutes) VALUES ('a0000001-0000-0000-0000-000000000014', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', '2026-05-09', 10)$$,
  '42501',
  'new row violates row-level security policy for table "time_entries"'
);

RESET ROLE;

-- Test 8: Anonymous SELECT returns 0 rows (not hard error with USING policies)
SET ROLE anon;
SELECT is(
  (SELECT count(*) FROM time_entries),
  0::bigint,
  'Anonymous SELECT returns 0 rows on time_entries'
);

RESET ROLE;

-- Test 9: Anonymous denied INSERT
SET ROLE anon;
SELECT throws_ok(
  $$INSERT INTO time_entries (id, workspace_id, client_id, user_id, date, duration_minutes) VALUES ('a0000001-0000-0000-0000-000000000099', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '2026-05-10', 5)$$,
  '42501',
  'new row violates row-level security policy for table "time_entries"'
);

RESET ROLE;

-- Test 10: Service role can insert
SET ROLE service_role;
INSERT INTO time_entries (id, workspace_id, client_id, user_id, date, duration_minutes)
VALUES ('a0000001-0000-0000-0000-000000000015', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '2026-05-11', 5);
SELECT is(
  (SELECT count(*) FROM time_entries WHERE id = 'a0000001-0000-0000-0000-000000000015'),
  1::bigint,
  'Service role can INSERT time entries'
);

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
