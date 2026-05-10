-- pgTAP RLS tests: time_entries UPDATE policy
-- Purpose: Verify UPDATE authorization: owner of entry, admin/owner in workspace,
--          cross-workspace denied, deleted entries denied, anonymous denied, service_role bypass.
-- Related: Story 5.3 — Time Entry Editing & Invoice Impact Warnings
-- Tables: time_entries, clients, projects, workspace_members

BEGIN;

CREATE OR REPLACE FUNCTION reset_role() RETURNS void AS $$
BEGIN
  EXECUTE 'RESET ROLE';
END;
$$ LANGUAGE plpgsql;

SELECT plan(8);

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
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Workspace A', 'pgtap-te-update-ws-a'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Workspace B', 'pgtap-te-update-ws-b')
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

-- Create a time entry as member
INSERT INTO time_entries (id, workspace_id, client_id, user_id, date, duration_minutes)
VALUES
  ('te000001-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', '2026-05-01', 60)
ON CONFLICT (id) DO NOTHING;

-- Create a deleted time entry
INSERT INTO time_entries (id, workspace_id, client_id, user_id, date, duration_minutes, deleted_at)
VALUES
  ('te000001-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', '2026-05-02', 30, now())
ON CONFLICT (id) DO NOTHING;

-- Test 1: Owner of entry can update own non-deleted entry
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}';

UPDATE time_entries SET duration_minutes = 90 WHERE id = 'te000001-0000-0000-0000-000000000001';
SELECT is(
  (SELECT duration_minutes FROM time_entries WHERE id = 'te000001-0000-0000-0000-000000000001'),
  90,
  'Owner of entry can update own non-deleted entry'
);

PERFORM reset_role();

-- Test 2: Non-owner (member role) cannot update another member's entry
-- Create an entry owned by owner
INSERT INTO time_entries (id, workspace_id, client_id, user_id, date, duration_minutes)
VALUES ('te000001-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '2026-05-03', 45)
ON CONFLICT (id) DO NOTHING;

SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}';

UPDATE time_entries SET duration_minutes = 120 WHERE id = 'te000001-0000-0000-0000-000000000003';
SELECT is(
  (SELECT count(*) FROM time_entries WHERE id = 'te000001-0000-0000-0000-000000000003' AND duration_minutes = 120),
  0::bigint,
  'Non-owner member cannot update another member entry'
);

PERFORM reset_role();

-- Test 3: Admin CAN update any entry in workspace
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}';

UPDATE time_entries SET duration_minutes = 120 WHERE id = 'te000001-0000-0000-0000-000000000001';
SELECT is(
  (SELECT duration_minutes FROM time_entries WHERE id = 'te000001-0000-0000-0000-000000000001'),
  120,
  'Admin can update any entry in workspace'
);

PERFORM reset_role();

-- Test 4: Cannot update deleted entry
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}';

UPDATE time_entries SET duration_minutes = 200 WHERE id = 'te000001-0000-0000-0000-000000000002';
SELECT is(
  (SELECT count(*) FROM time_entries WHERE id = 'te000001-0000-0000-0000-000000000002' AND duration_minutes = 200),
  0::bigint,
  'Cannot update deleted entry'
);

PERFORM reset_role();

-- Test 5: Cannot change user_id via UPDATE
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}';

UPDATE time_entries SET user_id = '11111111-1111-1111-1111-111111111111' WHERE id = 'te000001-0000-0000-0000-000000000001';
SELECT is(
  (SELECT user_id FROM time_entries WHERE id = 'te000001-0000-0000-0000-000000000001'),
  '33333333-3333-3333-3333-333333333333',
  'Cannot change user_id via UPDATE (WITH CHECK blocks it)'
);

PERFORM reset_role();

-- Test 6: Cross-workspace update denied
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "55555555-5555-5555-5555-555555555555", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}';

UPDATE time_entries SET duration_minutes = 999 WHERE id = 'te000001-0000-0000-0000-000000000001';
SELECT is(
  (SELECT count(*) FROM time_entries WHERE id = 'te000001-0000-0000-0000-000000000001' AND duration_minutes = 999),
  0::bigint,
  'Cross-workspace update denied'
);

PERFORM reset_role();

-- Test 7: Anonymous denied
SET ROLE anon;
SELECT throws_ok(
  $$UPDATE time_entries SET duration_minutes = 999 WHERE id = 'te000001-0000-0000-0000-000000000001'$$,
  '42501',
  'Anonymous denied UPDATE on time_entries'
);

PERFORM reset_role();

-- Test 8: Service role allowed
SET ROLE service_role;
UPDATE time_entries SET duration_minutes = 55 WHERE id = 'te000001-0000-0000-0000-000000000001';
SELECT is(
  (SELECT duration_minutes FROM time_entries WHERE id = 'te000001-0000-0000-0000-000000000001'),
  55,
  'Service role can update time entries'
);

PERFORM reset_role();

SELECT * FROM finish();
ROLLBACK;
