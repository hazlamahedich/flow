-- pgTAP RLS tests: workspaces table
-- Purpose: Verify workspace RLS policies across roles and tenants
-- Related: Story 1.2 AC#9 — P0 gate, all tests must pass

BEGIN;

SELECT plan(12);

-- Setup: Create two tenants with users
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'owner_a@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', '{}'),
  ('22222222-2222-2222-2222-222222222222', 'member_a@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', '{}'),
  ('33333333-3333-3333-3333-333333333333', 'owner_b@test.com', '{"workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', '{}');

INSERT INTO users (id, email, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'owner_a@test.com', 'Owner A'),
  ('22222222-2222-2222-2222-222222222222', 'member_a@test.com', 'Member A'),
  ('33333333-3333-3333-3333-333333333333', 'owner_b@test.com', 'Owner B');

INSERT INTO workspaces (id, name) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Workspace A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Workspace B');

INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'member'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 'owner');

-- Owner can read own workspace
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SELECT results_eq(
  'SELECT count(*) FROM workspaces',
  ARRAY[ARRAY['1'::bigint]],
  'Owner A sees exactly 1 workspace (own)'
);
SELECT reset_role();

-- Member can read own workspace
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SELECT results_eq(
  'SELECT count(*) FROM workspaces',
  ARRAY[ARRAY['1'::bigint]],
  'Member A sees exactly 1 workspace (own)'
);
SELECT reset_role();

-- Owner B cannot see Workspace A
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', false);
SELECT results_eq(
  'SELECT count(*) FROM workspaces WHERE id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  ARRAY[ARRAY['0'::bigint]],
  'Owner B cannot see Workspace A (cross-tenant denied)'
);
SELECT results_eq(
  'SELECT count(*) FROM workspaces',
  ARRAY[ARRAY['1'::bigint]],
  'Owner B sees exactly 1 workspace (own)'
);
SELECT reset_role();

-- Owner can update own workspace
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SELECT lives_ok(
  'UPDATE workspaces SET name = ''Updated A'' WHERE id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  'Owner can update own workspace name'
);
SELECT reset_role();

-- Member cannot update workspace
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SELECT throws_ok(
  'UPDATE workspaces SET name = ''Hacked'' WHERE id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  '42501',
  'Member cannot update workspace'
);
SELECT reset_role();

-- Authenticated user without workspace_id sees nothing
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', false);
SELECT results_eq(
  'SELECT count(*) FROM workspaces',
  ARRAY[ARRAY['0'::bigint]],
  'User without workspace_id sees 0 workspaces'
);
SELECT reset_role();

-- Cleanup
DELETE FROM workspace_members;
DELETE FROM workspaces;
DELETE FROM users;
DELETE FROM auth.users WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333');

SELECT * FROM finish();
ROLLBACK;
