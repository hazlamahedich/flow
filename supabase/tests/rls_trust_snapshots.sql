-- pgTAP RLS tests: trust_snapshots table
-- Purpose: Verify trust_snapshots RLS policies — service_role writes, member reads
-- Related: Story 2.3 AC#11 — P0 gate

BEGIN;

SELECT plan(6);

INSERT INTO workspaces (id, name, slug) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'WS Alpha', 'pgtap-ts-alpha'),
  ('a0000000-0000-0000-0000-000000000002', 'WS Beta', 'pgtap-ts-beta')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'owner-a@pgtap-ts.test', '{}', '{}'),
  ('b0000000-0000-0000-0000-000000000003', 'member-a@pgtap-ts.test', '{}', '{}'),
  ('b0000000-0000-0000-0000-000000000004', 'owner-b@pgtap-ts.test', '{}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'owner-a@pgtap-ts.test'),
  ('b0000000-0000-0000-0000-000000000003', 'member-a@pgtap-ts.test'),
  ('b0000000-0000-0000-0000-000000000004', 'owner-b@pgtap-ts.test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'owner'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'member'),
  ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000004', 'owner')
ON CONFLICT DO NOTHING;

-- TC-01: Owner can SELECT own workspace snapshots (empty)
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000001", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "owner"}', false);
SELECT results_eq(
  $$ SELECT count(*) FROM trust_snapshots WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' $$,
  ARRAY[0::bigint],
  'TC-01: owner can query own workspace snapshots'
);
RESET ROLE;

-- TC-02: Member can SELECT own workspace snapshots
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000003", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "member"}', false);
SELECT results_eq(
  $$ SELECT count(*) FROM trust_snapshots WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' $$,
  ARRAY[0::bigint],
  'TC-02: member can query own workspace snapshots'
);
RESET ROLE;

-- TC-03: Workspace isolation
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000004", "workspace_id": "a0000000-0000-0000-0000-000000000002", "role": "owner"}', false);
SELECT results_eq(
  $$ SELECT count(*) FROM trust_snapshots WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' $$,
  ARRAY[0::bigint],
  'TC-03: cannot see other workspace snapshots'
);
RESET ROLE;

-- TC-04: Owner cannot INSERT snapshots (service_role only)
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000001", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "owner"}', false);
SELECT throws_ok(
  $$ INSERT INTO trust_snapshots (workspace_id, execution_id, agent_id, action_type, matrix_version, level, score, snapshot_hash) VALUES ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'inbox', 'general', 1, 'supervised', 50, 'abc123') $$,
  '42501'
);
RESET ROLE;

-- TC-05: No UPDATE (no policy — 0 rows affected)
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000001", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "owner"}', false);
SELECT lives_ok(
  $$ UPDATE trust_snapshots SET score = 999 WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' $$,
  'TC-05: update does not throw (no rows to affect)'
);
RESET ROLE;

-- TC-06: No DELETE (no policy — 0 rows affected)
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000001", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "owner"}', false);
SELECT lives_ok(
  $$ DELETE FROM trust_snapshots WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' $$,
  'TC-06: delete does not throw (no rows to affect)'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
