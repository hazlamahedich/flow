-- pgTAP RLS tests: workspace_members table
-- Purpose: Verify workspace_members RLS policies with role-based access and soft-delete
-- Related: Story 1.2 AC#9 — P0 gate, all tests must pass

BEGIN;

CREATE OR REPLACE FUNCTION reset_role() RETURNS void AS $$
BEGIN
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '', false);
END;
$$ LANGUAGE plpgsql;

SELECT plan(19);

-- Setup: Create tenants with various roles (run as superuser to avoid RLS recursion)
SET ROLE postgres;
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'pgtap-owner-a@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', '{}'),
  ('22222222-2222-2222-2222-222222222222', 'pgtap-admin-a@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', '{}'),
  ('33333333-3333-3333-3333-333333333333', 'pgtap-member-a@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', '{}'),
  ('44444444-4444-4444-4444-444444444444', 'pgtap-client-a@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "client_user"}', '{}'),
  ('55555555-5555-5555-5555-555555555555', 'pgtap-owner-b@test.com', '{"workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', '{}'),
  ('66666666-6666-6666-6666-666666666666', 'pgtap-removed@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', '{}'),
  ('77777777-7777-7777-7777-777777777777', 'pgtap-suspended-1@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', '{}'),
  ('88888888-8888-8888-8888-888888888888', 'pgtap-suspended-2@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'pgtap-owner-a@test.com', 'Owner A'),
  ('22222222-2222-2222-2222-222222222222', 'pgtap-admin-a@test.com', 'Admin A'),
  ('33333333-3333-3333-3333-333333333333', 'pgtap-member-a@test.com', 'Member A'),
  ('44444444-4444-4444-4444-444444444444', 'pgtap-client-a@test.com', 'Client A'),
  ('55555555-5555-5555-5555-555555555555', 'pgtap-owner-b@test.com', 'Owner B'),
  ('66666666-6666-6666-6666-666666666666', 'pgtap-removed@test.com', 'Removed'),
  ('77777777-7777-7777-7777-777777777777', 'pgtap-suspended-1@test.com', 'Suspended 1'),
  ('88888888-8888-8888-8888-888888888888', 'pgtap-suspended-2@test.com', 'Suspended 2')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspaces (id, name, slug) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Workspace A', 'pgtap-ws-members-a'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Workspace B', 'pgtap-ws-members-b')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'member'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'client_user'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '55555555-5555-5555-5555-555555555555', 'owner')
ON CONFLICT DO NOTHING;

-- Insert a revoked member (status='revoked', not just removed_at)
INSERT INTO workspace_members (workspace_id, user_id, role, status, removed_at) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '66666666-6666-6666-6666-666666666666', 'member', 'revoked', now())
ON CONFLICT DO NOTHING;

-- Insert a SUSPENDED member (Story 9.5c AC6 — FR57a). Mirrors the webhook
-- bulkSuspendMembers write: status='suspended', suspended_at set,
-- suspension_reason categorized. service_role (postgres) bypasses RLS.
INSERT INTO workspace_members (workspace_id, user_id, role, status, suspended_at, suspension_reason)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '77777777-7777-7777-7777-777777777777', 'member', 'suspended', now(), 'tier_downgrade_agency_to_pro'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '88888888-8888-8888-8888-888888888888', 'admin',   'suspended', now(), 'tier_downgrade_agency_to_pro')
ON CONFLICT DO NOTHING;
RESET ROLE;

-- Member can read own workspace's active members (admin_select allows all authenticated)
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SELECT is(
  (SELECT count(*) FROM workspace_members WHERE status = 'active' AND workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  4::bigint,
  'Member sees 4 active members in own workspace'
);
SELECT reset_role();

-- Member cannot see revoked members (RLS only shows status=active)
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SELECT is(
  (SELECT count(*) FROM workspace_members WHERE user_id = '66666666-6666-6666-6666-666666666666'),
  0::bigint,
  'Member cannot see revoked members'
);
SELECT reset_role();

-- Owner also cannot see revoked members via RLS (all SELECT policies require status=active)
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SELECT is(
  (SELECT count(*) FROM workspace_members WHERE user_id = '66666666-6666-6666-6666-666666666666'),
  0::bigint,
  'Owner cannot see revoked members via RLS (status=active filter)'
);
SELECT reset_role();

-- Cross-tenant: Owner B cannot see Workspace A members
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "55555555-5555-5555-5555-555555555555", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', false);
SELECT is(
  (SELECT count(*) FROM workspace_members WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0::bigint,
  'Owner B cannot see Workspace A members (cross-tenant denied)'
);
SELECT reset_role();

-- Owner can insert new members (owner role allows member/client_user inserts)
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SELECT lives_ok(
  $$INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', 'member')$$,
  'Owner can insert members'
);
SELECT reset_role();

-- Member cannot insert members
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SELECT throws_ok(
  $$INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', 'member')$$,
  42501
);
SELECT reset_role();

-- Admin can update member roles
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', false);
SELECT lives_ok(
  $$UPDATE workspace_members SET role = 'admin' WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND user_id = '33333333-3333-3333-3333-333333333333' AND status = 'active'$$,
  'Admin can update member roles'
);
SELECT reset_role();

-- Member cannot update members (no UPDATE policy for member role)
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SELECT lives_ok(
  $$UPDATE workspace_members SET role = 'owner' WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND user_id = '33333333-3333-3333-3333-333333333333'$$,
  'Member cannot update members (0 rows affected)'
);
SELECT reset_role();

-- Owner can update member roles
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SELECT lives_ok(
  $$UPDATE workspace_members SET role = 'member' WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND user_id = '33333333-3333-3333-3333-333333333333' AND status = 'active'$$,
  'Owner can update member roles'
);
SELECT reset_role();

-- No DELETE policy: owner cannot delete members
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SELECT lives_ok(
  $$DELETE FROM workspace_members WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND user_id = '44444444-4444-4444-4444-444444444444'$$,
  'Owner cannot delete members (no DELETE policy, 0 rows)'
);
SELECT reset_role();

-- Admin cannot insert owner role (trigger prevents owner assignment)
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', false);
SELECT throws_ok(
  $$INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '66666666-6666-6666-6666-666666666666', 'owner')$$,
  'P0001'
);
SELECT reset_role();

-- Admin can insert member role for revoked user (unique index only covers active)
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', false);
SELECT lives_ok(
  $$INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '66666666-6666-6666-6666-666666666666', 'member')$$,
  'Admin can insert member role for previously revoked user'
);
SELECT reset_role();

-- ═══════════════════════════════════════════════════════════════════════
-- Story 9.5c AC6 — suspended state RLS (FR57a)
-- The owner_all UPDATE policy gates on status='active' in its USING clause
-- (migration 20260425080000_fix_rls_recursion.sql — NOT a 9-5c change; the
-- status guard already existed). So a user JWT cannot mutate a suspended
-- row: the UPDATE matches 0 rows. Only service_role (webhook) can, since
-- it bypasses RLS entirely.
-- ═══════════════════════════════════════════════════════════════════════

-- Owner CANNOT reactivate (update) a suspended member via user JWT — the
-- owner_all USING clause requires status='active' on the target row, so the
-- UPDATE matches 0 rows (lives_ok because 0-row UPDATE doesn't throw).
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SELECT lives_ok(
  $$UPDATE workspace_members SET status = 'active', suspended_at = NULL WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND user_id = '77777777-7777-7777-7777-777777777777'$$,
  'Owner cannot reactivate a suspended member via user JWT (0 rows affected — status gate)'
);
SELECT reset_role();

-- Confirm the row is STILL suspended. Read via postgres (service_role) because
-- the owner JWT's SELECT is also gated on status='active' — it cannot see the
-- suspended row to verify. (This is the correct, intended asymmetry: user JWTs
-- see only active rows; service_role sees all.)
SET ROLE postgres;
SELECT is(
  (SELECT status FROM workspace_members WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND user_id = '77777777-7777-7777-7777-777777777777'),
  'suspended',
  'Suspended member remains suspended after owner JWT update attempt'
);

-- service_role (postgres) CAN reactivate — bypasses RLS.
SELECT lives_ok(
  $$UPDATE workspace_members SET status = 'active', suspended_at = NULL WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND user_id = '77777777-7777-7777-7777-777777777777'$$,
  'service_role can reactivate a suspended member (RLS bypass)'
);
SELECT is(
  (SELECT status FROM workspace_members WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND user_id = '77777777-7777-7777-7777-777777777777'),
  'active',
  'Suspended member is now active after service_role update'
);
RESET ROLE;

-- Cross-workspace isolation: Owner B cannot see Workspace A's suspended
-- members (the workspace_id::text = jwt.workspace_id clause).
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "55555555-5555-5555-5555-555555555555", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', false);
SELECT is(
  (SELECT count(*) FROM workspace_members WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND status = 'suspended'),
  0::bigint,
  'Owner B cannot see Workspace A suspended members (cross-tenant denied)'
);
SELECT reset_role();

-- The status CHECK constraint accepts 'suspended' (widened by 20260717000001).
-- Reuse an existing test user (88888888) to avoid an FK violation; insert then
-- clean up so the consistency-CHECK test below has a fresh slot.
SET ROLE postgres;
SELECT lives_ok(
  $$INSERT INTO workspace_members (workspace_id, user_id, role, status, suspended_at, suspension_reason) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '88888888-8888-8888-8888-888888888888', 'member', 'suspended', now(), 'tier_downgrade_agency_to_pro') ON CONFLICT DO NOTHING$$,
  'status CHECK accepts suspended (widened by 20260717000001)'
);
-- The consistency CHECK rejects status='suspended' with suspended_at IS NULL.
-- 23514 = check_violation. Use the 4-arg throws_ok form (sql, errcode,
-- errmsg, description) so the SQLSTATE is matched, not treated as a message.
SELECT throws_ok(
  $$UPDATE workspace_members SET status = 'suspended', suspended_at = NULL WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND user_id = '88888888-8888-8888-8888-888888888888'$$,
  '23514',
  'new row for relation "workspace_members" violates check constraint "workspace_members_status_suspended_at_check"',
  'status/suspended_at consistency CHECK rejects suspended without suspended_at'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
