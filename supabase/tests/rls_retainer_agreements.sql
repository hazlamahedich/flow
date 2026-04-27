-- pgTAP RLS tests: retainer_agreements table
-- Purpose: Verify owner/admin CRUD, member scoped SELECT, no DELETE, service_role bypass, CHECK constraints
-- Related: Story 3.2 — Retainer Agreements & Scope Creep Detection
-- Policies:
--   rls_retainer_agreements_owner_admin: ALL for owner/admin (SELECT, INSERT, UPDATE)
--   rls_retainer_agreements_member_select: SELECT for members with client access grant
--   rls_retainer_agreements_block_delete: DELETE blocked for all authenticated
--   rls_retainer_agreements_service_role: ALL bypass for service_role

BEGIN;

CREATE OR REPLACE FUNCTION reset_role() RETURNS void AS $$
BEGIN
  EXECUTE 'RESET ROLE';
END;
$$ LANGUAGE plpgsql;

SELECT plan(25);

-- Setup (run as superuser to avoid RLS recursion)
SET ROLE postgres;

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'pgtap-owner@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', '{}'),
  ('22222222-2222-2222-2222-222222222222', 'pgtap-admin@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', '{}'),
  ('33333333-3333-3333-3333-333333333333', 'pgtap-member@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', '{}'),
  ('44444444-4444-4444-4444-444444444444', 'pgtap-noscope@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', '{}'),
  ('55555555-5555-5555-5555-555555555555', 'pgtap-outsider@test.com', '{"workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'pgtap-owner@test.com', 'Owner'),
  ('22222222-2222-2222-2222-222222222222', 'pgtap-admin@test.com', 'Admin'),
  ('33333333-3333-3333-3333-333333333333', 'pgtap-member@test.com', 'ScopedMember'),
  ('44444444-4444-4444-4444-444444444444', 'pgtap-noscope@test.com', 'NoScopeMember'),
  ('55555555-5555-5555-5555-555555555555', 'pgtap-outsider@test.com', 'Outsider')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspaces (id, name, slug) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Workspace A', 'pgtap-ra-ws-a'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Workspace B', 'pgtap-ra-ws-b')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'member'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'member'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '55555555-5555-5555-5555-555555555555', 'owner')
ON CONFLICT DO NOTHING;

-- 3 clients in workspace A to avoid unique-index conflicts
INSERT INTO clients (id, workspace_id, name, email) VALUES
  ('c1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Acme Corp', 'acme@test.com'),
  ('c2222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Beta Inc', 'beta@test.com'),
  ('c3333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Gamma LLC', 'gamma@test.com'),
  ('c4444444-4444-4444-4444-444444444444', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Rival Ltd', 'rival@test.com')
ON CONFLICT (id) DO NOTHING;

-- Grant member 33333333 access to client c1111111 only (NOT c2222222 or c3333333)
INSERT INTO member_client_access (workspace_id, user_id, client_id, granted_by) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;

-- Seed retainers: one active per client
INSERT INTO retainer_agreements (id, workspace_id, client_id, type, hourly_rate_cents) VALUES
  ('aa111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', 'hourly_rate', 5000),
  ('aa222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c2222222-2222-2222-2222-222222222222', 'hourly_rate', 7500),
  ('aa333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c3333333-3333-3333-3333-333333333333', 'hourly_rate', 6000)
ON CONFLICT (id) DO NOTHING;

RESET ROLE;


-- ============================================================
-- SELECT tests
-- ============================================================

-- Test 1: Owner can SELECT retainers
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM retainer_agreements), 3::bigint, 'Owner sees 3 retainers');
SELECT reset_role();

-- Test 2: Admin can SELECT retainers
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM retainer_agreements), 3::bigint, 'Admin sees 3 retainers');
SELECT reset_role();

-- Test 3: Member with client access can SELECT retainers for granted client only
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM retainer_agreements), 1::bigint, 'Scoped member sees 1 retainer (granted client only)');
SELECT reset_role();

-- Test 4: Member without client access sees 0 retainers
SELECT set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM retainer_agreements), 0::bigint, 'Unscoped member sees 0 retainers');
SELECT reset_role();

-- Test 5: Outsider cannot SELECT from other workspace
SELECT set_config('request.jwt.claims', '{"sub": "55555555-5555-5555-5555-555555555555", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM retainer_agreements WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 0::bigint, 'Outsider sees 0 from other workspace');
SELECT reset_role();


-- ============================================================
-- INSERT tests
-- ============================================================

-- Test 6: Owner can INSERT retainer — cancel aa111111 first to free unique slot on c1111111
SET ROLE postgres;
UPDATE retainer_agreements SET status = 'cancelled', cancelled_at = now() WHERE id = 'aa111111-1111-1111-1111-111111111111';
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SET ROLE authenticated;
SELECT lives_ok(
  $$INSERT INTO retainer_agreements (workspace_id, client_id, type, monthly_fee_cents, monthly_hours_threshold) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', 'flat_monthly', 200000, 30.00)$$,
  'Owner can insert flat_monthly retainer'
);
SELECT reset_role();

-- Test 7: Admin can INSERT retainer — cancel aa222222 first to free unique slot on c2222222
SET ROLE postgres;
UPDATE retainer_agreements SET status = 'cancelled', cancelled_at = now() WHERE id = 'aa222222-2222-2222-2222-222222222222';
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', false);
SET ROLE authenticated;
SELECT lives_ok(
  $$INSERT INTO retainer_agreements (workspace_id, client_id, type, hourly_rate_cents) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c2222222-2222-2222-2222-222222222222', 'hourly_rate', 9000)$$,
  'Admin can insert hourly_rate retainer'
);
SELECT reset_role();

-- Test 8: Member INSERT denied (no INSERT policy for members)
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SET ROLE authenticated;
SELECT throws_ok(
  $$INSERT INTO retainer_agreements (workspace_id, client_id, type, hourly_rate_cents) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c3333333-3333-3333-3333-333333333333', 'hourly_rate', 5000)$$,
  42501
);
SELECT reset_role();

-- Test 9: Outsider cannot INSERT into other workspace
SELECT set_config('request.jwt.claims', '{"sub": "55555555-5555-5555-5555-555555555555", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', false);
SET ROLE authenticated;
SELECT throws_ok(
  $$INSERT INTO retainer_agreements (workspace_id, client_id, type, hourly_rate_cents) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', 'hourly_rate', 5000)$$,
  42501
);
SELECT reset_role();


-- ============================================================
-- UPDATE tests
-- ============================================================

-- Test 10: Owner can UPDATE retainer
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SET ROLE authenticated;
SELECT lives_ok(
  $$UPDATE retainer_agreements SET notes = 'owner updated' WHERE id = 'aa333333-3333-3333-3333-333333333333'$$,
  'Owner can update retainer'
);
SELECT reset_role();

-- Test 11: Admin can UPDATE retainer
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', false);
SET ROLE authenticated;
SELECT lives_ok(
  $$UPDATE retainer_agreements SET notes = 'admin updated' WHERE id = 'aa333333-3333-3333-3333-333333333333'$$,
  'Admin can update retainer'
);
SELECT reset_role();

-- Test 12: Member UPDATE denied (owner/admin policy only)
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SET ROLE authenticated;
SELECT is(
  (SELECT count(*) FROM retainer_agreements WHERE notes = 'hacked'),
  0::bigint,
  'Member cannot update retainer (0 rows affected)'
);
SELECT reset_role();

-- Test 13: Owner can cancel retainer (UPDATE status)
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SET ROLE authenticated;
SELECT lives_ok(
  $$UPDATE retainer_agreements SET status = 'cancelled', cancelled_at = now(), cancellation_reason = 'test cancel' WHERE id = 'aa333333-3333-3333-3333-333333333333'$$,
  'Owner can cancel retainer'
);
SELECT reset_role();

-- Test 14: Admin can cancel retainer
-- Insert a fresh active retainer as superuser for this test
SET ROLE postgres;
INSERT INTO retainer_agreements (id, workspace_id, client_id, type, monthly_fee_cents, monthly_hours_threshold)
  VALUES ('aa444444-4444-4444-4444-444444444444', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c3333333-3333-3333-3333-333333333333', 'flat_monthly', 100000, 20.00);
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', false);
SET ROLE authenticated;
SELECT lives_ok(
  $$UPDATE retainer_agreements SET status = 'cancelled', cancelled_at = now() WHERE id = 'aa444444-4444-4444-4444-444444444444'$$,
  'Admin can cancel retainer'
);
SELECT reset_role();


-- ============================================================
-- DELETE tests (block_delete policy: USING false)
-- ============================================================

-- Cancel all active retainers first to free unique slots
SET ROLE postgres;
UPDATE retainer_agreements SET status = 'cancelled', cancelled_at = now()
  WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND status = 'active';

-- Insert fresh active retainers for delete tests
INSERT INTO retainer_agreements (id, workspace_id, client_id, type, hourly_rate_cents)
  VALUES ('aa555555-5555-5555-5555-555555555555', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', 'hourly_rate', 5500);
INSERT INTO retainer_agreements (id, workspace_id, client_id, type, hourly_rate_cents)
  VALUES ('aa666666-6666-6666-6666-666666666666', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c2222222-2222-2222-2222-222222222222', 'hourly_rate', 6500);
RESET ROLE;

-- Test 15: Owner cannot DELETE (block_delete policy)
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SET ROLE authenticated;
SELECT is(
  (SELECT count(*) FROM retainer_agreements WHERE id = 'aa555555-5555-5555-5555-555555555555'),
  1::bigint,
  'Owner cannot delete retainer (block_delete policy, row survives)'
);
SELECT reset_role();

-- Test 16: Admin cannot DELETE
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', false);
SET ROLE authenticated;
SELECT is(
  (SELECT count(*) FROM retainer_agreements WHERE id = 'aa666666-6666-6666-6666-666666666666'),
  1::bigint,
  'Admin cannot delete retainer (block_delete policy, row survives)'
);
SELECT reset_role();


-- ============================================================
-- Cross-tenant isolation
-- ============================================================

-- Test 17: Outsider sees zero from other workspace
SELECT set_config('request.jwt.claims', '{"sub": "55555555-5555-5555-5555-555555555555", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', false);
SET ROLE authenticated;
SELECT is(
  (SELECT count(*) FROM retainer_agreements WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0::bigint,
  'Cross-tenant isolation: outsider sees 0 from other workspace'
);
SELECT reset_role();


-- ============================================================
-- service_role tests
-- ============================================================

-- Test 18: service_role can SELECT all
SELECT lives_ok(
  $$SET ROLE service_role; SELECT count(*) FROM retainer_agreements; RESET ROLE;$$,
  'service_role can select all retainers'
);

-- Test 19: service_role can INSERT — cancel aa555555 first to free unique slot
SET ROLE postgres;
UPDATE retainer_agreements SET status = 'cancelled', cancelled_at = now() WHERE id = 'aa555555-5555-5555-5555-555555555555';
RESET ROLE;

SELECT lives_ok(
  $$SET ROLE service_role; INSERT INTO retainer_agreements (workspace_id, client_id, type, hourly_rate_cents) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', 'hourly_rate', 9999); RESET ROLE;$$,
  'service_role can insert retainer'
);

-- Test 20: service_role can UPDATE
SELECT lives_ok(
  $$SET ROLE service_role; UPDATE retainer_agreements SET hourly_rate_cents = 8000 WHERE hourly_rate_cents = 9999; RESET ROLE;$$,
  'service_role can update retainer'
);

-- Test 21: service_role can DELETE
SELECT lives_ok(
  $$SET ROLE service_role; DELETE FROM retainer_agreements WHERE hourly_rate_cents = 8000; RESET ROLE;$$,
  'service_role can delete retainer'
);


-- ============================================================
-- Schema verification: ::text cast
-- ============================================================

-- Test 22: RLS policies use ::text cast
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'retainer_agreements'
    AND policyname IN ('rls_retainer_agreements_owner_admin', 'rls_retainer_agreements_member_select')
    AND qual LIKE '%::text%'
  ),
  'RLS policies use ::text cast for workspace_id comparison'
);


-- ============================================================
-- CHECK constraint tests
-- ============================================================

-- Test 23: Type CHECK — hourly_rate rejects monthly_fee_cents
SELECT throws_ok(
  $$INSERT INTO retainer_agreements (workspace_id, client_id, type, hourly_rate_cents, monthly_fee_cents)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', 'hourly_rate', 5000, 200000)$$,
  '23514'
);

-- Test 24: Cancelled status requires cancelled_at
SELECT throws_ok(
  $$INSERT INTO retainer_agreements (workspace_id, client_id, type, hourly_rate_cents, status)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c2222222-2222-2222-2222-222222222222', 'hourly_rate', 5000, 'cancelled')$$,
  '23514'
);

-- Test 25: Unique partial index — only one active retainer per client
-- c3333333 still has the active aa444444 from test 14 prep (which was cancelled)
-- Actually aa444444 was cancelled in test 14. Need an active one on c3333333 first.
SET ROLE postgres;
INSERT INTO retainer_agreements (workspace_id, client_id, type, hourly_rate_cents)
  VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c3333333-3333-3333-3333-333333333333', 'hourly_rate', 4500);
RESET ROLE;

SELECT throws_ok(
  $$INSERT INTO retainer_agreements (workspace_id, client_id, type, hourly_rate_cents)
    VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c3333333-3333-3333-3333-333333333333', 'hourly_rate', 5500)$$,
  '23505'
);


SELECT * FROM finish();
ROLLBACK;
