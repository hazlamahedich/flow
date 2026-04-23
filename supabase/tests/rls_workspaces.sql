-- pgTAP RLS tests: workspaces table
-- Purpose: Verify workspace RLS policies across roles and tenants
-- Related: Story 1.2 AC#9 — P0 gate, all tests must pass

BEGIN;

CREATE OR REPLACE FUNCTION reset_role() RETURNS void AS $$
BEGIN
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '', false);
END;
$$ LANGUAGE plpgsql;

SELECT plan(8);

-- Setup: Create two tenants with users (run as superuser to avoid RLS recursion)
SET ROLE postgres;
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'pgtap-ws-owner-a@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', '{}'),
  ('22222222-2222-2222-2222-222222222222', 'pgtap-ws-member-a@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', '{}'),
  ('33333333-3333-3333-3333-333333333333', 'pgtap-ws-owner-b@test.com', '{"workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'pgtap-ws-owner-a@test.com', 'Owner A'),
  ('22222222-2222-2222-2222-222222222222', 'pgtap-ws-member-a@test.com', 'Member A'),
  ('33333333-3333-3333-3333-333333333333', 'pgtap-ws-owner-b@test.com', 'Owner B')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspaces (id, name, slug) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Workspace A', 'pgtap-ws-a'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Workspace B', 'pgtap-ws-b')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'member'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 'owner')
ON CONFLICT DO NOTHING;
RESET ROLE;

-- Owner can read own workspace
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SELECT is(
  (SELECT count(*) FROM workspaces),
  1::bigint,
  'Owner A sees exactly 1 workspace (own)'
);
SELECT reset_role();

-- Member can read own workspace
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SELECT is(
  (SELECT count(*) FROM workspaces),
  1::bigint,
  'Member A sees exactly 1 workspace (own)'
);
SELECT reset_role();

-- Owner B cannot see Workspace A
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', false);
SELECT is(
  (SELECT count(*) FROM workspaces WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0::bigint,
  'Owner B cannot see Workspace A (cross-tenant denied)'
);
SELECT reset_role();

-- Owner B sees own workspace only
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', false);
SELECT is(
  (SELECT count(*) FROM workspaces),
  1::bigint,
  'Owner B sees exactly 1 workspace (own)'
);
SELECT reset_role();

-- Owner cannot update workspace (no UPDATE policy on workspaces table)
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SELECT lives_ok(
  'UPDATE workspaces SET name = ''Updated A'' WHERE id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  'Owner cannot update workspace (no UPDATE policy, 0 rows)'
);
SELECT reset_role();

-- Member cannot update workspace
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', false);
SELECT lives_ok(
  'UPDATE workspaces SET name = ''Hacked'' WHERE id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  'Member cannot update workspace (0 rows)'
);
SELECT reset_role();

-- Authenticated user without workspace_id sees nothing
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', false);
SELECT is(
  (SELECT count(*) FROM workspaces),
  0::bigint,
  'User without workspace_id sees 0 workspaces'
);
SELECT reset_role();

-- Verify workspace data unchanged after UPDATE attempts
SET ROLE postgres;
SELECT is(
  (SELECT name FROM workspaces WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'Workspace A'::text,
  'Workspace A name unchanged after UPDATE attempts'
);
SELECT reset_role();

SELECT * FROM finish();
ROLLBACK;
