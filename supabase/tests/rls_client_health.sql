-- pgTAP RLS tests for client_health_snapshots table
-- Story 8.3: Client Health Agent & Usage Analytics

BEGIN;

SELECT plan(8);

-- Bootstrap: create test helpers (match existing pgTAP patterns)
-- Assumes pgTAP extension already installed

-- ───────────────────────────────────────────────────────────────
-- Setup: Create test workspace, users, and roles
-- ───────────────────────────────────────────────────────────────

-- Clean up any previous test data
DELETE FROM client_health_snapshots WHERE workspace_id IN (
  SELECT id FROM workspaces WHERE name LIKE 'rls_test_%'
);

-- Create test users (if not exists)
INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at)
VALUES
  ('11111111-1111-1111-1111-111111111101', 'rls_owner@test.com', '{"full_name":"Owner"}', now(), now()),
  ('11111111-1111-1111-1111-111111111102', 'rls_admin@test.com', '{"full_name":"Admin"}', now(), now()),
  ('11111111-1111-1111-1111-111111111103', 'rls_member@test.com', '{"full_name":"Member"}', now(), now()),
  ('11111111-1111-1111-1111-111111111104', 'rls_other@test.com', '{"full_name":"Other"}', now(), now())
ON CONFLICT (id) DO NOTHING;

-- Create test workspaces
INSERT INTO workspaces (id, name, slug, owner_id, created_at)
VALUES
  ('22222222-2222-2222-2222-222222222201', 'rls_test_ws_a', 'rls-test-ws-a', '11111111-1111-1111-1111-111111111101', now()),
  ('22222222-2222-2222-2222-222222222202', 'rls_test_ws_b', 'rls-test-ws-b', '11111111-1111-1111-1111-111111111104', now())
ON CONFLICT (id) DO NOTHING;

-- Create workspace memberships
INSERT INTO workspace_members (workspace_id, user_id, role, created_at)
VALUES
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 'owner', now()),
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111102', 'admin', now()),
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111103', 'member', now()),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111104', 'owner', now())
ON CONFLICT DO NOTHING;

-- Create test clients
INSERT INTO clients (id, workspace_id, name, status, created_at)
VALUES
  ('33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222201', 'Client A', 'active', now()),
  ('33333333-3333-3333-3333-333333333302', '22222222-2222-2222-2222-222222222202', 'Client B', 'active', now())
ON CONFLICT (id) DO NOTHING;

-- ───────────────────────────────────────────────────────────────
-- Test 1: Table exists with correct structure
-- ───────────────────────────────────────────────────────────────
SELECT has_table('client_health_snapshots', 'Table client_health_snapshots exists');

SELECT has_column('client_health_snapshots', 'workspace_id', 'client_health_snapshots has workspace_id column');
SELECT has_column('client_health_snapshots', 'client_id', 'client_health_snapshots has client_id column');
SELECT has_column('client_health_snapshots', 'overall_health', 'client_health_snapshots has overall_health column');

-- ───────────────────────────────────────────────────────────────
-- Test 2: RLS is enabled
-- ───────────────────────────────────────────────────────────────
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'client_health_snapshots'),
  true,
  'RLS is enabled on client_health_snapshots'
);

-- ───────────────────────────────────────────────────────────────
-- Test 3: Owner can SELECT snapshots in their workspace
-- ───────────────────────────────────────────────────────────────
SET request.jwt.claims = '{"workspace_id": "22222222-2222-2222-2222-222222222201", "role": "owner", "sub": "11111111-1111-1111-1111-111111111101"}';

SELECT lives_ok(
  $$SELECT * FROM client_health_snapshots WHERE workspace_id = '22222222-2222-2222-2222-222222222201'$$,
  'Owner can SELECT snapshots in their workspace'
);

-- ───────────────────────────────────────────────────────────────
-- Test 4: Member can SELECT snapshots in their workspace
-- ───────────────────────────────────────────────────────────────
SET request.jwt.claims = '{"workspace_id": "22222222-2222-2222-2222-222222222201", "role": "member", "sub": "11111111-1111-1111-1111-111111111103"}';

SELECT lives_ok(
  $$SELECT * FROM client_health_snapshots WHERE workspace_id = '22222222-2222-2222-2222-222222222201'$$,
  'Member can SELECT snapshots in their workspace'
);

-- ───────────────────────────────────────────────────────────────
-- Test 5: Cross-tenant isolation — WS A member cannot see WS B snapshots
-- ───────────────────────────────────────────────────────────────

-- Seed a health snapshot for WS B's client so the test is meaningful
SET LOCAL ROLE service_role;
INSERT INTO client_health_snapshots (workspace_id, client_id, snapshot_date, engagement_score, payment_score, communication_score, overall_health, indicators)
VALUES ('22222222-2222-2222-2222-222222222202', '33333333-3333-3333-3333-333333333302', '2026-05-28', 75, 85, 65, 'healthy', '{}')
ON CONFLICT DO NOTHING;
RESET ROLE;

SET request.jwt.claims = '{"workspace_id": "22222222-2222-2222-2222-222222222201", "role": "member", "sub": "11111111-1111-1111-1111-111111111103"}';

SELECT is_empty(
  $$SELECT * FROM client_health_snapshots WHERE workspace_id = '22222222-2222-2222-2222-222222222202'$$,
  'Workspace A member sees zero rows from Workspace B even when WS B has snapshots'
);

-- ───────────────────────────────────────────────────────────────
-- Test 6: Regular user cannot INSERT snapshots (service_role only)
-- ───────────────────────────────────────────────────────────────
SET request.jwt.claims = '{"workspace_id": "22222222-2222-2222-2222-222222222201", "role": "owner", "sub": "11111111-1111-1111-1111-111111111101"}';

SELECT throws_ok(
  $$INSERT INTO client_health_snapshots (workspace_id, client_id, snapshot_date, engagement_score, payment_score, communication_score, overall_health, indicators)
    VALUES ('22222222-2222-2222-2222-222222222201', '33333333-3333-3333-3333-333333333301', '2026-05-25', 80, 90, 70, 'healthy', '{}')$$,
  '42501',
  NULL,
  'Owner cannot INSERT into client_health_snapshots (service_role only)'
);

-- ───────────────────────────────────────────────────────────────
-- Cleanup
-- ───────────────────────────────────────────────────────────────
RESET request.jwt.claims;

SELECT * FROM finish();
ROLLBACK;
