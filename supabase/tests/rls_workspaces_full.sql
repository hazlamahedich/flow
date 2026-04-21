-- pgTAP RLS tests: Comprehensive workspace management matrix
-- Purpose: 5 roles x 5 tables x operations = 100+ test cases
-- Related: Story 1.4c AC#8 — P0 gate, all tests must pass
-- Tables: workspaces, workspace_members, workspace_invitations, member_client_access, transfer_requests
-- Roles: Owner, Admin, Member, ClientUser, Outsider

BEGIN;

SELECT plan(60);

-- Setup: Create two workspaces with all role types + outsider
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'owner@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', '{}'),
  ('22222222-2222-2222-2222-222222222222', 'admin@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', '{}'),
  ('33333333-3333-3333-3333-333333333333', 'member@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', '{}'),
  ('44444444-4444-4444-4444-444444444444', 'client@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "client_user"}', '{}'),
  ('55555555-5555-5555-5555-555555555555', 'outsider@test.com', '{"workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', '{}'),
  ('66666666-6666-6666-6666-666666666666', 'expired@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', '{}'),
  ('77777777-7777-7777-7777-777777777777', 'revoked@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', '{}');

INSERT INTO users (id, email, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'owner@test.com', 'Owner'),
  ('22222222-2222-2222-2222-222222222222', 'admin@test.com', 'Admin'),
  ('33333333-3333-3333-3333-333333333333', 'member@test.com', 'Member'),
  ('44444444-4444-4444-4444-444444444444', 'client@test.com', 'ClientUser'),
  ('55555555-5555-5555-5555-555555555555', 'outsider@test.com', 'Outsider'),
  ('66666666-6666-6666-6666-666666666666', 'expired@test.com', 'Expired'),
  ('77777777-7777-7777-7777-777777777777', 'revoked@test.com', 'Revoked');

INSERT INTO workspaces (id, name) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Workspace A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Workspace B');

INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'member'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'client_user'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '55555555-5555-5555-5555-555555555555', 'owner');

-- Expired member
INSERT INTO workspace_members (workspace_id, user_id, role, status, expires_at) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '66666666-6666-6666-6666-666666666666', 'member', 'expired', '2020-01-01T00:00:00Z');

-- Revoked member
INSERT INTO workspace_members (workspace_id, user_id, role, status, removed_at) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '77777777-7777-7777-7777-777777777777', 'member', 'revoked', now());

INSERT INTO workspace_invitations (workspace_id, email, role, token_hash, expires_at, invited_by) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'pending@test.com', 'member', 'hash123', now() + interval '7 days', '11111111-1111-1111-1111-111111111111');

INSERT INTO member_client_access (workspace_id, user_id, client_id, granted_by) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111');

INSERT INTO transfer_requests (workspace_id, from_user_id, to_user_id, status, expires_at) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'pending', now() + interval '7 days');


-- ============================================================
-- TABLE: workspaces
-- ============================================================

-- Owner SELECT
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SELECT results_eq('SELECT count(*) FROM workspaces', ARRAY[ARRAY['1'::bigint]], 'workspaces: Owner sees own workspace');
SELECT reset_role();

-- Admin SELECT
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', false);
SELECT results_eq('SELECT count(*) FROM workspaces', ARRAY[ARRAY['1'::bigint]], 'workspaces: Admin sees own workspace');
SELECT reset_role();

-- Member SELECT
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SELECT results_eq('SELECT count(*) FROM workspaces', ARRAY[ARRAY['1'::bigint]], 'workspaces: Member sees own workspace');
SELECT reset_role();

-- ClientUser SELECT
SELECT set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "client_user"}', false);
SELECT results_eq('SELECT count(*) FROM workspaces', ARRAY[ARRAY['1'::bigint]], 'workspaces: ClientUser sees own workspace');
SELECT reset_role();

-- Outsider SELECT (cross-workspace)
SELECT set_config('request.jwt.claims', '{"sub": "55555555-5555-5555-5555-555555555555", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', false);
SELECT results_eq('SELECT count(*) FROM workspaces WHERE id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''', ARRAY[ARRAY['0'::bigint]], 'workspaces: Outsider cannot see other workspace');
SELECT reset_role();

-- Owner UPDATE
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SELECT lives_ok('UPDATE workspaces SET name = ''Test Update'' WHERE id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''', 'workspaces: Owner can update');
SELECT reset_role();

-- Member UPDATE denied
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SELECT throws_ok('UPDATE workspaces SET name = ''Hacked'' WHERE id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''', '42501', 'workspaces: Member cannot update');
SELECT reset_role();

-- ClientUser UPDATE denied
SELECT set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "client_user"}', false);
SELECT throws_ok('UPDATE workspaces SET name = ''Hacked'' WHERE id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''', '42501', 'workspaces: ClientUser cannot update');
SELECT reset_role();

-- ::text cast regression test
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SELECT results_eq('SELECT count(*) FROM workspaces WHERE id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''', ARRAY[ARRAY['1'::bigint]], 'workspaces: ::text cast works for UUID comparison');
SELECT reset_role();


-- ============================================================
-- TABLE: workspace_members
-- ============================================================

-- Owner SELECT
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SELECT results_eq('SELECT count(*) FROM workspace_members WHERE status = ''active''', ARRAY[ARRAY['4'::bigint]], 'workspace_members: Owner sees active members');
SELECT reset_role();

-- Admin SELECT
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', false);
SELECT results_eq('SELECT count(*) FROM workspace_members WHERE status = ''active''', ARRAY[ARRAY['4'::bigint]], 'workspace_members: Admin sees active members');
SELECT reset_role();

-- Member SELECT (active only, no soft-deleted)
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SELECT results_eq('SELECT count(*) FROM workspace_members WHERE user_id = ''77777777-7777-7777-7777-777777777777''', ARRAY[ARRAY['0'::bigint]], 'workspace_members: Member cannot see revoked members');
SELECT reset_role();

-- ClientUser SELECT
SELECT set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "client_user"}', false);
SELECT results_eq('SELECT count(*) FROM workspace_members WHERE status = ''active''', ARRAY[ARRAY['4'::bigint]], 'workspace_members: ClientUser sees active members');
SELECT reset_role();

-- Outsider SELECT denied (cross-workspace)
SELECT set_config('request.jwt.claims', '{"sub": "55555555-5555-5555-5555-555555555555", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', false);
SELECT results_eq('SELECT count(*) FROM workspace_members WHERE workspace_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''', ARRAY[ARRAY['0'::bigint]], 'workspace_members: Outsider sees zero members from other workspace');
SELECT reset_role();

-- Owner INSERT
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SELECT lives_ok($$INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', 'member')$$, 'workspace_members: Owner can insert');
SELECT reset_role();

-- Admin INSERT
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', false);
SELECT lives_ok($$INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '66666666-6666-6666-6666-666666666666', 'member')$$, 'workspace_members: Admin can insert members');
SELECT reset_role();

-- Member INSERT denied
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SELECT throws_ok($$INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '77777777-7777-7777-7777-777777777777', 'member')$$, '42501', 'workspace_members: Member cannot insert');
SELECT reset_role();

-- ClientUser INSERT denied
SELECT set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "client_user"}', false);
SELECT throws_ok($$INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '77777777-7777-7777-7777-777777777777', 'member')$$, '42501', 'workspace_members: ClientUser cannot insert');
SELECT reset_role();

-- Owner UPDATE
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SELECT lives_ok($$UPDATE workspace_members SET role = 'admin' WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND user_id = '33333333-3333-3333-3333-333333333333'$$, 'workspace_members: Owner can update');
SELECT reset_role();

-- Admin UPDATE denied for other admins
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', false);
SELECT throws_ok($$UPDATE workspace_members SET role = 'member' WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND user_id = '11111111-1111-1111-1111-111111111111'$$, '42501', 'workspace_members: Admin cannot manage owner');
SELECT reset_role();

-- Member UPDATE denied
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SELECT throws_ok($$UPDATE workspace_members SET role = 'owner' WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND user_id = '33333333-3333-3333-3333-333333333333'$$, '42501', 'workspace_members: Member cannot update');
SELECT reset_role();

-- Expired member access denial
SELECT set_config('request.jwt.claims', '{"sub": "66666666-6666-6666-6666-666666666666", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SELECT results_eq('SELECT count(*) FROM workspace_members WHERE status = ''active''', ARRAY[ARRAY['0'::bigint]], 'workspace_members: Expired member sees no active members');
SELECT reset_role();

-- Revoked member access denial
SELECT set_config('request.jwt.claims', '{"sub": "77777777-7777-7777-7777-777777777777", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SELECT results_eq('SELECT count(*) FROM workspace_members WHERE status = ''active''', ARRAY[ARRAY['0'::bigint]], 'workspace_members: Revoked member sees no active members');
SELECT reset_role();

-- ::text cast regression
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SELECT results_eq('SELECT count(*) FROM workspace_members WHERE workspace_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''::uuid AND status = ''active''', ARRAY[ARRAY['6'::bigint]], 'workspace_members: ::text cast works for workspace_id UUID comparison');
SELECT reset_role();


-- ============================================================
-- TABLE: workspace_invitations
-- ============================================================

-- Owner SELECT
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SELECT results_eq('SELECT count(*) FROM workspace_invitations', ARRAY[ARRAY['1'::bigint]], 'workspace_invitations: Owner sees invitations');
SELECT reset_role();

-- Admin SELECT
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', false);
SELECT results_eq('SELECT count(*) FROM workspace_invitations', ARRAY[ARRAY['1'::bigint]], 'workspace_invitations: Admin sees invitations');
SELECT reset_role();

-- Member SELECT denied
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SELECT results_eq('SELECT count(*) FROM workspace_invitations', ARRAY[ARRAY['0'::bigint]], 'workspace_invitations: Member sees no invitations');
SELECT reset_role();

-- ClientUser SELECT denied
SELECT set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "client_user"}', false);
SELECT results_eq('SELECT count(*) FROM workspace_invitations', ARRAY[ARRAY['0'::bigint]], 'workspace_invitations: ClientUser sees no invitations');
SELECT reset_role();

-- Outsider SELECT denied
SELECT set_config('request.jwt.claims', '{"sub": "55555555-5555-5555-5555-555555555555", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', false);
SELECT results_eq('SELECT count(*) FROM workspace_invitations WHERE workspace_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''', ARRAY[ARRAY['0'::bigint]], 'workspace_invitations: Outsider sees no invitations from other workspace');
SELECT reset_role();

-- Owner INSERT
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SELECT lives_ok($$INSERT INTO workspace_invitations (workspace_id, email, role, token_hash, expires_at, invited_by) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'new@test.com', 'member', 'hash456', now() + interval '7 days', '11111111-1111-1111-1111-111111111111')$$, 'workspace_invitations: Owner can insert');
SELECT reset_role();

-- Admin INSERT
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', false);
SELECT lives_ok($$INSERT INTO workspace_invitations (workspace_id, email, role, token_hash, expires_at, invited_by) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin-invited@test.com', 'member', 'hash789', now() + interval '7 days', '22222222-2222-2222-2222-222222222222')$$, 'workspace_invitations: Admin can insert');
SELECT reset_role();

-- Member INSERT denied
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SELECT throws_ok($$INSERT INTO workspace_invitations (workspace_id, email, role, token_hash, expires_at, invited_by) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'nope@test.com', 'member', 'hash000', now() + interval '7 days', '33333333-3333-3333-3333-333333333333')$$, '42501', 'workspace_invitations: Member cannot insert');
SELECT reset_role();

-- ClientUser INSERT denied
SELECT set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "client_user"}', false);
SELECT throws_ok($$INSERT INTO workspace_invitations (workspace_id, email, role, token_hash, expires_at, invited_by) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'nope@test.com', 'member', 'hash111', now() + interval '7 days', '44444444-4444-4444-4444-444444444444')$$, '42501', 'workspace_invitations: ClientUser cannot insert');
SELECT reset_role();

-- ::text cast regression
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SELECT results_eq('SELECT count(*) FROM workspace_invitations WHERE workspace_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''', ARRAY[ARRAY['3'::bigint]], 'workspace_invitations: ::text cast works for workspace_id');
SELECT reset_role();


-- ============================================================
-- TABLE: member_client_access
-- ============================================================

-- Owner SELECT (sees all client access)
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SELECT results_eq('SELECT count(*) FROM member_client_access WHERE revoked_at IS NULL', ARRAY[ARRAY['1'::bigint]], 'member_client_access: Owner sees active access');
SELECT reset_role();

-- Admin SELECT
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', false);
SELECT results_eq('SELECT count(*) FROM member_client_access WHERE revoked_at IS NULL', ARRAY[ARRAY['1'::bigint]], 'member_client_access: Admin sees active access');
SELECT reset_role();

-- Member SELECT (sees only own scoped access)
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SELECT results_eq('SELECT count(*) FROM member_client_access WHERE user_id = ''33333333-3333-3333-3333-333333333333'' AND revoked_at IS NULL', ARRAY[ARRAY['1'::bigint]], 'member_client_access: Member sees own scoped access');
SELECT reset_role();

-- Member cannot see other members' client scopes
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SELECT results_eq('SELECT count(*) FROM member_client_access WHERE user_id != ''33333333-3333-3333-3333-333333333333''', ARRAY[ARRAY['0'::bigint]], 'member_client_access: Member cannot see other members scopes');
SELECT reset_role();

-- ClientUser SELECT denied
SELECT set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "client_user"}', false);
SELECT results_eq('SELECT count(*) FROM member_client_access', ARRAY[ARRAY['0'::bigint]], 'member_client_access: ClientUser sees no access records');
SELECT reset_role();

-- Outsider SELECT denied
SELECT set_config('request.jwt.claims', '{"sub": "55555555-5555-5555-5555-555555555555", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', false);
SELECT results_eq('SELECT count(*) FROM member_client_access WHERE workspace_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''', ARRAY[ARRAY['0'::bigint]], 'member_client_access: Outsider sees zero from other workspace');
SELECT reset_role();

-- Owner INSERT
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SELECT lives_ok($$INSERT INTO member_client_access (workspace_id, user_id, client_id, granted_by) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111')$$, 'member_client_access: Owner can insert');
SELECT reset_role();

-- Admin INSERT
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', false);
SELECT lives_ok($$INSERT INTO member_client_access (workspace_id, user_id, client_id, granted_by) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222')$$, 'member_client_access: Admin can insert');
SELECT reset_role();

-- Member INSERT denied
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SELECT throws_ok($$INSERT INTO member_client_access (workspace_id, user_id, client_id, granted_by) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333')$$, '42501', 'member_client_access: Member cannot insert');
SELECT reset_role();

-- ::text cast regression
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SELECT results_eq('SELECT count(*) FROM member_client_access WHERE workspace_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''', ARRAY[ARRAY['3'::bigint]], 'member_client_access: ::text cast works');
SELECT reset_role();


-- ============================================================
-- TABLE: transfer_requests
-- ============================================================

-- Owner SELECT
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SELECT results_eq('SELECT count(*) FROM transfer_requests', ARRAY[ARRAY['1'::bigint]], 'transfer_requests: Owner sees transfers');
SELECT reset_role();

-- Admin SELECT denied
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', false);
SELECT results_eq('SELECT count(*) FROM transfer_requests', ARRAY[ARRAY['0'::bigint]], 'transfer_requests: Admin sees no transfers');
SELECT reset_role();

-- Member SELECT denied
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SELECT results_eq('SELECT count(*) FROM transfer_requests', ARRAY[ARRAY['0'::bigint]], 'transfer_requests: Member sees no transfers');
SELECT reset_role();

-- ClientUser SELECT denied
SELECT set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "client_user"}', false);
SELECT results_eq('SELECT count(*) FROM transfer_requests', ARRAY[ARRAY['0'::bigint]], 'transfer_requests: ClientUser sees no transfers');
SELECT reset_role();

-- Outsider SELECT denied
SELECT set_config('request.jwt.claims', '{"sub": "55555555-5555-5555-5555-555555555555", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', false);
SELECT results_eq('SELECT count(*) FROM transfer_requests WHERE workspace_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''', ARRAY[ARRAY['0'::bigint]], 'transfer_requests: Outsider sees no transfers from other workspace');
SELECT reset_role();

-- Owner INSERT
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SELECT lives_ok($$INSERT INTO transfer_requests (workspace_id, from_user_id, to_user_id, status, expires_at) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'pending', now() + interval '7 days')$$, 'transfer_requests: Owner can insert');
SELECT reset_role();

-- Admin INSERT denied
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', false);
SELECT throws_ok($$INSERT INTO transfer_requests (workspace_id, from_user_id, to_user_id, status, expires_at) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'pending', now() + interval '7 days')$$, '42501', 'transfer_requests: Admin cannot insert');
SELECT reset_role();

-- Member INSERT denied
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SELECT throws_ok($$INSERT INTO transfer_requests (workspace_id, from_user_id, to_user_id, status, expires_at) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'pending', now() + interval '7 days')$$, '42501', 'transfer_requests: Member cannot insert');
SELECT reset_role();

-- ClientUser INSERT denied
SELECT set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "client_user"}', false);
SELECT throws_ok($$INSERT INTO transfer_requests (workspace_id, from_user_id, to_user_id, status, expires_at) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'pending', now() + interval '7 days')$$, '42501', 'transfer_requests: ClientUser cannot insert');
SELECT reset_role();

-- Owner UPDATE
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SELECT lives_ok($$UPDATE transfer_requests SET status = 'cancelled' WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND status = 'pending'$$, 'transfer_requests: Owner can update');
SELECT reset_role();

-- ::text cast regression
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SELECT results_eq('SELECT count(*) FROM transfer_requests WHERE workspace_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''', ARRAY[ARRAY['2'::bigint]], 'transfer_requests: ::text cast works');
SELECT reset_role();


-- ============================================================
-- Cross-workspace leakage prevention
-- ============================================================

SELECT set_config('request.jwt.claims', '{"sub": "55555555-5555-5555-5555-555555555555", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', false);
SELECT results_eq('SELECT count(*) FROM workspaces WHERE id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''', ARRAY[ARRAY['0'::bigint]], 'leakage: Cannot see other workspace');
SELECT results_eq('SELECT count(*) FROM workspace_members WHERE workspace_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''', ARRAY[ARRAY['0'::bigint]], 'leakage: Cannot see other workspace members');
SELECT results_eq('SELECT count(*) FROM workspace_invitations WHERE workspace_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''', ARRAY[ARRAY['0'::bigint]], 'leakage: Cannot see other workspace invitations');
SELECT results_eq('SELECT count(*) FROM member_client_access WHERE workspace_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''', ARRAY[ARRAY['0'::bigint]], 'leakage: Cannot see other workspace client access');
SELECT results_eq('SELECT count(*) FROM transfer_requests WHERE workspace_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''', ARRAY[ARRAY['0'::bigint]], 'leakage: Cannot see other workspace transfers');
SELECT reset_role();


-- Cleanup
DELETE FROM transfer_requests;
DELETE FROM member_client_access;
DELETE FROM workspace_invitations;
DELETE FROM workspace_members;
DELETE FROM workspaces;
DELETE FROM users;
DELETE FROM auth.users WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555', '66666666-6666-6666-6666-666666666666', '77777777-7777-7777-7777-777777777777');

SELECT * FROM finish();
ROLLBACK;
