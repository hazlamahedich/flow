-- pgTAP RLS tests: workspace_members table
-- Purpose: Verify workspace_members RLS policies with role-based access and soft-delete
-- Related: Story 1.2 AC#9 — P0 gate, all tests must pass

BEGIN;

SELECT plan(14);

-- Setup: Create tenants with various roles
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'owner_a@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', '{}'),
  ('22222222-2222-2222-2222-222222222222', 'admin_a@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', '{}'),
  ('33333333-3333-3333-3333-333333333333', 'member_a@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', '{}'),
  ('44444444-4444-4444-4444-444444444444', 'client_a@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "client_user"}', '{}'),
  ('55555555-5555-5555-5555-555555555555', 'owner_b@test.com', '{"workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', '{}'),
  ('66666666-6666-6666-6666-666666666666', 'removed@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', '{}');

INSERT INTO users (id, email, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'owner_a@test.com', 'Owner A'),
  ('22222222-2222-2222-2222-222222222222', 'admin_a@test.com', 'Admin A'),
  ('33333333-3333-3333-3333-333333333333', 'member_a@test.com', 'Member A'),
  ('44444444-4444-4444-4444-444444444444', 'client_a@test.com', 'Client A'),
  ('55555555-5555-5555-5555-555555555555', 'owner_b@test.com', 'Owner B'),
  ('66666666-6666-6666-6666-666666666666', 'removed@test.com', 'Removed');

INSERT INTO workspaces (id, name) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Workspace A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Workspace B');

INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'member'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'client_user'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '55555555-5555-5555-5555-555555555555', 'owner');

-- Insert a soft-deleted member
INSERT INTO workspace_members (workspace_id, user_id, role, removed_at) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '66666666-6666-6666-6666-666666666666', 'member', now());

-- Member can read own workspace's active members
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SELECT results_eq(
  'SELECT count(*) FROM workspace_members WHERE removed_at IS NULL',
  ARRAY[ARRAY['4'::bigint]],
  'Member sees 4 active members in own workspace'
);
SELECT reset_role();

-- Member cannot see soft-deleted members
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SELECT results_eq(
  'SELECT count(*) FROM workspace_members WHERE user_id = ''66666666-6666-6666-6666-666666666666''',
  ARRAY[ARRAY['0'::bigint]],
  'Member cannot see soft-deleted members'
);
SELECT reset_role();

-- Owner can see soft-deleted members
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SELECT results_eq(
  'SELECT count(*) FROM workspace_members WHERE user_id = ''66666666-6666-6666-6666-666666666666''',
  ARRAY[ARRAY['1'::bigint]],
  'Owner can see soft-deleted members'
);
SELECT reset_role();

-- Cross-tenant: Owner B cannot see Workspace A members
SELECT set_config('request.jwt.claims', '{"sub": "55555555-5555-5555-5555-555555555555", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', false);
SELECT results_eq(
  'SELECT count(*) FROM workspace_members WHERE workspace_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  ARRAY[ARRAY['0'::bigint]],
  'Owner B cannot see Workspace A members (cross-tenant denied)'
);
SELECT reset_role();

-- Owner can insert new members
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SELECT lives_ok(
  $$INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '55555555-5555-5555-5555-555555555555', 'member')$$,
  'Owner can insert members'
);
SELECT reset_role();

-- Member cannot insert members
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SELECT throws_ok(
  $$INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '66666666-6666-6666-6666-666666666666', 'member')$$,
  '42501',
  'Member cannot insert members'
);
SELECT reset_role();

-- Admin can update member roles
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', false);
SELECT lives_ok(
  $$UPDATE workspace_members SET role = 'admin' WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND user_id = '33333333-3333-3333-3333-333333333333'$$,
  'Admin can update member roles'
);
SELECT reset_role();

-- Member cannot update members
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SELECT throws_ok(
  $$UPDATE workspace_members SET role = 'owner' WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND user_id = '33333333-3333-3333-3333-333333333333'$$,
  '42501',
  'Member cannot update members'
);
SELECT reset_role();

-- Cleanup
DELETE FROM workspace_members;
DELETE FROM workspaces;
DELETE FROM users;
DELETE FROM auth.users WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', '55555555-5555-5555-5555-555555555555', '66666666-6666-6666-6666-666666666666');

SELECT * FROM finish();
ROLLBACK;
