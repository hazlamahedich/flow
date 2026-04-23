-- pgTAP RLS tests: Comprehensive workspace management matrix
-- Purpose: 5 roles x 5 tables x operations = 60+ test cases
-- Related: Story 1.4c AC#8 — P0 gate, all tests must pass
-- Tables: workspaces, workspace_members, workspace_invitations, member_client_access, transfer_requests
-- Roles: Owner, Admin, Member, ClientUser, Outsider

BEGIN;

CREATE OR REPLACE FUNCTION reset_role() RETURNS void AS $$
BEGIN
  EXECUTE 'RESET ROLE';
END;
$$ LANGUAGE plpgsql;

SELECT plan(60);

-- Setup (run as superuser to avoid RLS recursion on workspace_members)
SET ROLE postgres;

-- Setup: Create two workspaces with all role types + outsider
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'pgtap-owner@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', '{}'),
  ('22222222-2222-2222-2222-222222222222', 'pgtap-admin@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', '{}'),
  ('33333333-3333-3333-3333-333333333333', 'pgtap-member@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', '{}'),
  ('44444444-4444-4444-4444-444444444444', 'pgtap-client@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "client_user"}', '{}'),
  ('55555555-5555-5555-5555-555555555555', 'pgtap-outsider@test.com', '{"workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', '{}'),
  ('66666666-6666-6666-6666-666666666666', 'pgtap-expired@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', '{}'),
  ('77777777-7777-7777-7777-777777777777', 'pgtap-revoked@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'pgtap-owner@test.com', 'Owner'),
  ('22222222-2222-2222-2222-222222222222', 'pgtap-admin@test.com', 'Admin'),
  ('33333333-3333-3333-3333-333333333333', 'pgtap-member@test.com', 'Member'),
  ('44444444-4444-4444-4444-444444444444', 'pgtap-client@test.com', 'ClientUser'),
  ('55555555-5555-5555-5555-555555555555', 'pgtap-outsider@test.com', 'Outsider'),
  ('66666666-6666-6666-6666-666666666666', 'pgtap-expired@test.com', 'Expired'),
  ('77777777-7777-7777-7777-777777777777', 'pgtap-revoked@test.com', 'Revoked')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspaces (id, name, slug) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Workspace A', 'pgtap-full-ws-a'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Workspace B', 'pgtap-full-ws-b')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'member'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'client_user'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '55555555-5555-5555-5555-555555555555', 'owner')
ON CONFLICT DO NOTHING;

-- Expired member (expires_at must be > joined_at per check constraint)
INSERT INTO workspace_members (workspace_id, user_id, role, status, joined_at, expires_at) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '66666666-6666-6666-6666-666666666666', 'member', 'expired', '2020-01-01T00:00:00Z', '2020-01-02T00:00:00Z')
ON CONFLICT DO NOTHING;

-- Revoked member
INSERT INTO workspace_members (workspace_id, user_id, role, status, removed_at) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '77777777-7777-7777-7777-777777777777', 'member', 'revoked', now())
ON CONFLICT DO NOTHING;

INSERT INTO workspace_invitations (workspace_id, email, role, token_hash, expires_at, invited_by) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'pending@test.com', 'member', 'hash123', now() + interval '7 days', '11111111-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;

INSERT INTO member_client_access (workspace_id, user_id, client_id, granted_by) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;

INSERT INTO transfer_requests (workspace_id, from_user_id, to_user_id, status, expires_at) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'pending', now() + interval '7 days')
ON CONFLICT DO NOTHING;

RESET ROLE;


-- ============================================================
-- TABLE: workspaces
-- ============================================================

-- Owner SELECT
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM workspaces), 1::bigint, 'workspaces: Owner sees own workspace');
SELECT reset_role();

-- Admin SELECT
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM workspaces), 1::bigint, 'workspaces: Admin sees own workspace');
SELECT reset_role();

-- Member SELECT
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM workspaces), 1::bigint, 'workspaces: Member sees own workspace');
SELECT reset_role();

-- ClientUser SELECT
SELECT set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "client_user"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM workspaces), 1::bigint, 'workspaces: ClientUser sees own workspace');
SELECT reset_role();

-- Outsider SELECT (cross-workspace)
SELECT set_config('request.jwt.claims', '{"sub": "55555555-5555-5555-5555-555555555555", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM workspaces WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 0::bigint, 'workspaces: Outsider cannot see other workspace');
SELECT reset_role();

-- Owner UPDATE (no UPDATE policy on workspaces, returns 0 rows)
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SET ROLE authenticated;
SELECT lives_ok('UPDATE workspaces SET name = ''Test Update'' WHERE id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''', 'workspaces: Owner UPDATE returns 0 (no UPDATE policy)');
SELECT reset_role();

-- Member UPDATE denied
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SET ROLE authenticated;
SELECT lives_ok('UPDATE workspaces SET name = ''Hacked'' WHERE id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''', 'workspaces: Member cannot update (0 rows)');
SELECT reset_role();

-- ClientUser UPDATE denied
SELECT set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "client_user"}', false);
SET ROLE authenticated;
SELECT lives_ok('UPDATE workspaces SET name = ''Hacked'' WHERE id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''', 'workspaces: ClientUser cannot update (0 rows)');
SELECT reset_role();

-- ::text cast regression test
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM workspaces WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 1::bigint, 'workspaces: ::text cast works for UUID comparison');
SELECT reset_role();


-- ============================================================
-- TABLE: workspace_members
-- ============================================================

-- Owner SELECT (sees active members only — owner_all qual has status='active')
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM workspace_members WHERE status = 'active'), 4::bigint, 'workspace_members: Owner sees 4 active members');
SELECT reset_role();

-- Admin SELECT (admin_select shows active members in workspace)
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM workspace_members WHERE status = 'active'), 4::bigint, 'workspace_members: Admin sees 4 active members');
SELECT reset_role();

-- Member SELECT (active only, no revoked)
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM workspace_members WHERE user_id = '77777777-7777-7777-7777-777777777777'), 0::bigint, 'workspace_members: Member cannot see revoked members');
SELECT reset_role();

-- ClientUser SELECT
SELECT set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "client_user"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM workspace_members WHERE status = 'active'), 4::bigint, 'workspace_members: ClientUser sees active members');
SELECT reset_role();

-- Outsider SELECT denied (cross-workspace)
SELECT set_config('request.jwt.claims', '{"sub": "55555555-5555-5555-5555-555555555555", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM workspace_members WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 0::bigint, 'workspace_members: Outsider sees zero from other workspace');
SELECT reset_role();

-- Owner INSERT (owner can insert member/client_user roles)
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SET ROLE authenticated;
SELECT lives_ok($$INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', 'member')$$, 'workspace_members: Owner can insert');
SELECT reset_role();

-- Admin INSERT (admin can insert member/client_user roles)
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', false);
SET ROLE authenticated;
SELECT lives_ok($$INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '66666666-6666-6666-6666-666666666666', 'member')$$, 'workspace_members: Admin can insert members');
SELECT reset_role();

-- Member INSERT denied
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SET ROLE authenticated;
SELECT throws_ok($$INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '77777777-7777-7777-7777-777777777777', 'member')$$, 42501);
SELECT reset_role();

-- ClientUser INSERT denied
SELECT set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "client_user"}', false);
SET ROLE authenticated;
SELECT throws_ok($$INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '77777777-7777-7777-7777-777777777777', 'member')$$, 42501);
SELECT reset_role();

-- Owner UPDATE (promote then revert member 33333333 to prove owner can update; revert to preserve role for later tests)
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SET ROLE authenticated;
SELECT lives_ok($$UPDATE workspace_members SET role = 'admin' WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND user_id = '33333333-3333-3333-3333-333333333333'$$, 'workspace_members: Owner can update');
SELECT reset_role();
-- Revert: put 33333333 back to 'member' so later invitation/client-access denial tests remain valid
SET ROLE postgres;
UPDATE workspace_members SET role = 'member' WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND user_id = '33333333-3333-3333-3333-333333333333';
RESET ROLE;

-- Admin UPDATE denied for owner rows (trigger prevents demoting last owner)
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', false);
SET ROLE authenticated;
SELECT throws_ok($$UPDATE workspace_members SET role = 'member' WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND user_id = '11111111-1111-1111-1111-111111111111'$$, 'P0001');
SELECT reset_role();

-- Member UPDATE denied
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SET ROLE authenticated;
SELECT lives_ok($$UPDATE workspace_members SET role = 'owner' WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND user_id = '33333333-3333-3333-3333-333333333333'$$, 'workspace_members: Member cannot update (0 rows)');
SELECT reset_role();

-- Expired member sees active members (RLS checks target row status, not user's own status)
SELECT set_config('request.jwt.claims', '{"sub": "66666666-6666-6666-6666-666666666666", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM workspace_members WHERE status = 'active'), 6::bigint, 'workspace_members: Expired member sees 6 active members (JWT-based RLS)');
SELECT reset_role();

-- Revoked member sees active members (RLS checks target row status, not user's own status)
SELECT set_config('request.jwt.claims', '{"sub": "77777777-7777-7777-7777-777777777777", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM workspace_members WHERE status = 'active'), 6::bigint, 'workspace_members: Revoked member sees 6 active members (JWT-based RLS)');
SELECT reset_role();

-- ::text cast regression — owner sees all active (4 original + 2 inserted by owner+admin = 6)
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM workspace_members WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND status = 'active'), 6::bigint, 'workspace_members: ::text cast works for workspace_id UUID comparison');
SELECT reset_role();


-- ============================================================
-- TABLE: workspace_invitations
-- ============================================================

-- Owner SELECT
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM workspace_invitations), 1::bigint, 'workspace_invitations: Owner sees invitations');
SELECT reset_role();

-- Admin SELECT
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM workspace_invitations), 1::bigint, 'workspace_invitations: Admin sees invitations');
SELECT reset_role();

-- Member SELECT (member_select allows all active members to see)
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM workspace_invitations), 1::bigint, 'workspace_invitations: Member sees invitations (active member policy)');
SELECT reset_role();

-- ClientUser SELECT (member_select allows all active members including client_user)
SELECT set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "client_user"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM workspace_invitations), 1::bigint, 'workspace_invitations: ClientUser sees invitations (active member policy)');
SELECT reset_role();

-- Outsider SELECT denied
SELECT set_config('request.jwt.claims', '{"sub": "55555555-5555-5555-5555-555555555555", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM workspace_invitations WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 0::bigint, 'workspace_invitations: Outsider sees no invitations from other workspace');
SELECT reset_role();

-- Owner INSERT
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SET ROLE authenticated;
SELECT lives_ok($$INSERT INTO workspace_invitations (workspace_id, email, role, token_hash, expires_at, invited_by) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'new@test.com', 'member', 'hash456', now() + interval '7 days', '11111111-1111-1111-1111-111111111111')$$, 'workspace_invitations: Owner can insert');
SELECT reset_role();

-- Admin INSERT
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', false);
SET ROLE authenticated;
SELECT lives_ok($$INSERT INTO workspace_invitations (workspace_id, email, role, token_hash, expires_at, invited_by) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin-invited@test.com', 'member', 'hash789', now() + interval '7 days', '22222222-2222-2222-2222-222222222222')$$, 'workspace_invitations: Admin can insert');
SELECT reset_role();

-- Member INSERT denied
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SELECT throws_ok($$INSERT INTO workspace_invitations (workspace_id, email, role, token_hash, expires_at, invited_by) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'nope@test.com', 'member', 'hash000', now() + interval '7 days', '33333333-3333-3333-3333-333333333333')$$, 42501);
SELECT reset_role();

-- ClientUser INSERT denied
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "client_user"}', false);
SELECT throws_ok($$INSERT INTO workspace_invitations (workspace_id, email, role, token_hash, expires_at, invited_by) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'nope@test.com', 'member', 'hash111', now() + interval '7 days', '44444444-4444-4444-4444-444444444444')$$, 42501);
SELECT reset_role();

-- ::text cast regression
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM workspace_invitations WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 3::bigint, 'workspace_invitations: ::text cast works for workspace_id');
SELECT reset_role();


-- ============================================================
-- TABLE: member_client_access
-- ============================================================

-- Owner SELECT (sees all client access)
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM member_client_access WHERE revoked_at IS NULL), 1::bigint, 'member_client_access: Owner sees active access');
SELECT reset_role();

-- Admin SELECT
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM member_client_access WHERE revoked_at IS NULL), 1::bigint, 'member_client_access: Admin sees active access');
SELECT reset_role();

-- Member SELECT (sees only own scoped access)
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM member_client_access WHERE user_id = '33333333-3333-3333-3333-333333333333' AND revoked_at IS NULL), 1::bigint, 'member_client_access: Member sees own scoped access');
SELECT reset_role();

-- Member cannot see other members' client scopes
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM member_client_access WHERE user_id != '33333333-3333-3333-3333-333333333333'), 0::bigint, 'member_client_access: Member cannot see other members scopes');
SELECT reset_role();

-- ClientUser SELECT denied (scoped policy only allows self or owner/admin)
SELECT set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "client_user"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM member_client_access), 0::bigint, 'member_client_access: ClientUser sees no access records');
SELECT reset_role();

-- Outsider SELECT denied
SELECT set_config('request.jwt.claims', '{"sub": "55555555-5555-5555-5555-555555555555", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM member_client_access WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 0::bigint, 'member_client_access: Outsider sees zero from other workspace');
SELECT reset_role();

-- Owner INSERT
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SET ROLE authenticated;
SELECT lives_ok($$INSERT INTO member_client_access (workspace_id, user_id, client_id, granted_by) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111')$$, 'member_client_access: Owner can insert');
SELECT reset_role();

-- Admin INSERT
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', false);
SET ROLE authenticated;
SELECT lives_ok($$INSERT INTO member_client_access (workspace_id, user_id, client_id, granted_by) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222')$$, 'member_client_access: Admin can insert');
SELECT reset_role();

-- Member INSERT denied
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SELECT throws_ok($$INSERT INTO member_client_access (workspace_id, user_id, client_id, granted_by) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333')$$, 42501);
SELECT reset_role();

-- ::text cast regression
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM member_client_access WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 3::bigint, 'member_client_access: ::text cast works');
SELECT reset_role();


-- ============================================================
-- TABLE: transfer_requests
-- ============================================================

-- Owner SELECT
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM transfer_requests), 1::bigint, 'transfer_requests: Owner sees transfers');
SELECT reset_role();

-- Admin SELECT denied
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM transfer_requests), 0::bigint, 'transfer_requests: Admin sees no transfers');
SELECT reset_role();

-- Member SELECT denied
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM transfer_requests), 0::bigint, 'transfer_requests: Member sees no transfers');
SELECT reset_role();

-- ClientUser SELECT denied
SELECT set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "client_user"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM transfer_requests), 0::bigint, 'transfer_requests: ClientUser sees no transfers');
SELECT reset_role();

-- Outsider SELECT denied
SELECT set_config('request.jwt.claims', '{"sub": "55555555-5555-5555-5555-555555555555", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM transfer_requests WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 0::bigint, 'transfer_requests: Outsider sees no transfers from other workspace');
SELECT reset_role();

-- Owner INSERT (use 'approved' status to avoid unique constraint on pending)
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SET ROLE authenticated;
SELECT lives_ok($$INSERT INTO transfer_requests (workspace_id, from_user_id, to_user_id, status, expires_at) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'cancelled', now() + interval '7 days')$$, 'transfer_requests: Owner can insert');
SELECT reset_role();

-- Admin INSERT denied
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', false);
SET ROLE authenticated;
SELECT throws_ok($$INSERT INTO transfer_requests (workspace_id, from_user_id, to_user_id, status, expires_at) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'pending', now() + interval '7 days')$$, 42501);
SELECT reset_role();

-- Member INSERT denied
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SET ROLE authenticated;
SELECT throws_ok($$INSERT INTO transfer_requests (workspace_id, from_user_id, to_user_id, status, expires_at) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'pending', now() + interval '7 days')$$, 42501);
SELECT reset_role();

-- ClientUser INSERT denied
SELECT set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "client_user"}', false);
SET ROLE authenticated;
SELECT throws_ok($$INSERT INTO transfer_requests (workspace_id, from_user_id, to_user_id, status, expires_at) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'pending', now() + interval '7 days')$$, 42501);
SELECT reset_role();

-- Owner UPDATE
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SET ROLE authenticated;
SELECT lives_ok($$UPDATE transfer_requests SET status = 'cancelled' WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND status = 'pending'$$, 'transfer_requests: Owner can update');
SELECT reset_role();

-- ::text cast regression
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM transfer_requests WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 2::bigint, 'transfer_requests: ::text cast works');
SELECT reset_role();


-- ============================================================
-- Cross-workspace leakage prevention
-- ============================================================

SELECT set_config('request.jwt.claims', '{"sub": "55555555-5555-5555-5555-555555555555", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', false);
SET ROLE authenticated;
SELECT is((SELECT count(*) FROM workspaces WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 0::bigint, 'leakage: Cannot see other workspace');
SELECT is((SELECT count(*) FROM workspace_members WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 0::bigint, 'leakage: Cannot see other workspace members');
SELECT is((SELECT count(*) FROM workspace_invitations WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 0::bigint, 'leakage: Cannot see other workspace invitations');
SELECT is((SELECT count(*) FROM member_client_access WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 0::bigint, 'leakage: Cannot see other workspace client access');
SELECT is((SELECT count(*) FROM transfer_requests WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 0::bigint, 'leakage: Cannot see other workspace transfers');
SELECT reset_role();


SELECT * FROM finish();
ROLLBACK;
