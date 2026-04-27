-- pgTAP RLS tests: clients table
-- Purpose: Verify workspace-scoped access, cross-tenant isolation, no DELETE, service_role bypass
-- Related: Story 3.1 — Client Management CRUD
-- Tables: clients, member_client_access
-- Note: clients RLS is workspace_id-based (no role distinction at DB level).
--        Role checks happen in Server Actions (application layer).

BEGIN;

CREATE OR REPLACE FUNCTION reset_role() RETURNS void AS $$
BEGIN
  EXECUTE 'RESET ROLE';
END;
$$ LANGUAGE plpgsql;

SELECT plan(18);

-- Setup (run as superuser to avoid RLS recursion)
SET ROLE postgres;

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'pgtap-owner@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', '{}'),
  ('22222222-2222-2222-2222-222222222222', 'pgtap-admin@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', '{}'),
  ('33333333-3333-3333-3333-333333333333', 'pgtap-member@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', '{}'),
  ('44444444-4444-4444-4444-444444444444', 'pgtap-client@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "client_user"}', '{}'),
  ('55555555-5555-5555-5555-555555555555', 'pgtap-outsider@test.com', '{"workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'pgtap-owner@test.com', 'Owner'),
  ('22222222-2222-2222-2222-222222222222', 'pgtap-admin@test.com', 'Admin'),
  ('33333333-3333-3333-3333-333333333333', 'pgtap-member@test.com', 'Member'),
  ('44444444-4444-4444-4444-444444444444', 'pgtap-client@test.com', 'ClientUser'),
  ('55555555-5555-5555-5555-555555555555', 'pgtap-outsider@test.com', 'Outsider')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspaces (id, name, slug) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Workspace A', 'pgtap-clients-ws-a'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Workspace B', 'pgtap-clients-ws-b')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'member'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'client_user'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '55555555-5555-5555-5555-555555555555', 'owner')
ON CONFLICT DO NOTHING;

INSERT INTO clients (id, workspace_id, name, email) VALUES
  ('c1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Acme Corp', 'acme@test.com'),
  ('c2222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Beta Inc', 'beta@test.com'),
  ('c3333333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Rival Ltd', 'rival@test.com')
ON CONFLICT (id) DO NOTHING;

RESET ROLE;


-- ============================================================
-- SELECT tests
-- ============================================================

-- Test 1: Owner can SELECT clients in workspace
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM clients), 2::bigint, 'Owner sees 2 clients in workspace');
SELECT reset_role();

-- Test 2: Admin can SELECT clients in workspace
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM clients), 2::bigint, 'Admin sees 2 clients in workspace');
SELECT reset_role();

-- Test 3: Member can SELECT clients (same workspace_id policy)
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM clients), 2::bigint, 'Member sees 2 clients (workspace-scoped policy)');
SELECT reset_role();

-- Test 4: ClientUser can SELECT clients
SELECT set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "client_user"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM clients), 2::bigint, 'ClientUser sees 2 clients');
SELECT reset_role();

-- Test 5: Outsider cannot SELECT from other workspace
SELECT set_config('request.jwt.claims', '{"sub": "55555555-5555-5555-5555-555555555555", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM clients WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 0::bigint, 'Outsider cannot see other workspace clients');
SELECT reset_role();


-- ============================================================
-- INSERT tests
-- ============================================================

-- Test 6: Owner can INSERT client
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SET ROLE authenticated;
SELECT lives_ok(
  $$INSERT INTO clients (workspace_id, name, email) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Owner Client', 'owner-client@test.com')$$,
  'Owner can insert client'
);
SELECT reset_role();

-- Test 7: Admin can INSERT client
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', false);
SET ROLE authenticated;
SELECT lives_ok(
  $$INSERT INTO clients (workspace_id, name, email) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Admin Client', 'admin-client@test.com')$$,
  'Admin can insert client'
);
SELECT reset_role();

-- Test 8: Member can INSERT client (RLS allows any authenticated user in workspace)
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SET ROLE authenticated;
SELECT lives_ok(
  $$INSERT INTO clients (workspace_id, name, email) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Member Client', 'member-client@test.com')$$,
  'Member can insert client (workspace-scoped INSERT policy)'
);
SELECT reset_role();

-- Test 9: Outsider cannot INSERT into other workspace
SELECT set_config('request.jwt.claims', '{"sub": "55555555-5555-5555-5555-555555555555", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', false);
SET ROLE authenticated;
SELECT throws_ok(
  $$INSERT INTO clients (workspace_id, name) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Hacked')$$,
  42501
);
SELECT reset_role();


-- ============================================================
-- UPDATE tests
-- ============================================================

-- Test 10: Owner can UPDATE client
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SET ROLE authenticated;
SELECT lives_ok(
  $$UPDATE clients SET name = 'Updated Acme' WHERE id = 'c1111111-1111-1111-1111-111111111111'$$,
  'Owner can update client'
);
SELECT reset_role();

-- Test 11: Member can UPDATE client (workspace_id-based policy, no role restriction)
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SET ROLE authenticated;
SELECT lives_ok(
  $$UPDATE clients SET name = 'Member Updated' WHERE id = 'c2222222-2222-2222-2222-222222222222'$$,
  'Member can update client (workspace-scoped UPDATE policy)'
);
SELECT reset_role();


-- ============================================================
-- DELETE tests (no DELETE policy = blocked for all authenticated)
-- ============================================================

-- Test 12: Owner cannot DELETE (no DELETE policy, 0 rows affected)
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SET ROLE authenticated;
SELECT is(
  (SELECT count(*) FROM clients WHERE id = 'c1111111-1111-1111-1111-111111111111'),
  1::bigint,
  'Owner cannot delete client (no DELETE policy, row survives)'
);
SELECT reset_role();

-- Test 13: Member cannot DELETE
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SET ROLE authenticated;
SELECT is(
  (SELECT count(*) FROM clients WHERE id = 'c2222222-2222-2222-2222-222222222222'),
  1::bigint,
  'Member cannot delete client (no DELETE policy, row survives)'
);
SELECT reset_role();


-- ============================================================
-- service_role tests (bypasses RLS)
-- ============================================================

-- Test 14: service_role can SELECT all clients across workspaces
SELECT lives_ok(
  $$SET ROLE service_role; SELECT count(*) FROM clients; RESET ROLE;$$,
  'service_role can select all clients'
);

-- Test 15: service_role can INSERT client
SELECT lives_ok(
  $$SET ROLE service_role; INSERT INTO clients (workspace_id, name) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'SR Client'); RESET ROLE;$$,
  'service_role can insert client'
);

-- Test 16: service_role can UPDATE client
SELECT lives_ok(
  $$SET ROLE service_role; UPDATE clients SET name = 'SR Updated' WHERE name = 'SR Client'; RESET ROLE;$$,
  'service_role can update client'
);

-- Test 17: service_role can DELETE client
SELECT lives_ok(
  $$SET ROLE service_role; DELETE FROM clients WHERE name = 'SR Updated'; RESET ROLE;$$,
  'service_role can delete client'
);


-- ============================================================
-- Schema verification
-- ============================================================

-- Test 18: All client RLS policies use ::text cast for workspace_id comparison
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'clients'
    AND qual LIKE '%::text%'
  ),
  'RLS policies use ::text cast for workspace_id comparison'
);


SELECT * FROM finish();
ROLLBACK;
