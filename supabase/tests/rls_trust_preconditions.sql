-- pgTAP RLS tests: trust_preconditions table
-- Purpose: Verify trust_preconditions RLS policies — owner/admin CRUD, member SELECT, workspace isolation
-- Related: Story 2.3 AC#4 — P0 gate

BEGIN;

SELECT plan(8);

INSERT INTO workspaces (id, name, slug) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'WS Alpha', 'pgtap-tp-alpha'),
  ('a0000000-0000-0000-0000-000000000002', 'WS Beta', 'pgtap-tp-beta')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'owner-a@pgtap-tp.test', '{}', '{}'),
  ('b0000000-0000-0000-0000-000000000002', 'admin-a@pgtap-tp.test', '{}', '{}'),
  ('b0000000-0000-0000-0000-000000000003', 'member-a@pgtap-tp.test', '{}', '{}'),
  ('b0000000-0000-0000-0000-000000000004', 'owner-b@pgtap-tp.test', '{}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'owner-a@pgtap-tp.test'),
  ('b0000000-0000-0000-0000-000000000002', 'admin-a@pgtap-tp.test'),
  ('b0000000-0000-0000-0000-000000000003', 'member-a@pgtap-tp.test'),
  ('b0000000-0000-0000-0000-000000000004', 'owner-b@pgtap-tp.test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'owner'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'admin'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'member'),
  ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000004', 'owner')
ON CONFLICT DO NOTHING;

INSERT INTO trust_preconditions (workspace_id, agent_id, action_type, condition_key, condition_expr) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'inbox', 'general', 'business_hours', 'hour >= 9 AND hour <= 17'),
  ('a0000000-0000-0000-0000-000000000002', 'inbox', 'general', 'always', 'true')
ON CONFLICT DO NOTHING;

-- TC-01: Owner can SELECT own workspace preconditions
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000001", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "owner"}', false);
SELECT results_eq(
  $$ SELECT count(*) FROM trust_preconditions WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' $$,
  ARRAY[1::bigint],
  'TC-01: owner can see own workspace preconditions'
);
RESET ROLE;

-- TC-02: Member can SELECT own workspace preconditions
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000003", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "member"}', false);
SELECT results_eq(
  $$ SELECT count(*) FROM trust_preconditions WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' $$,
  ARRAY[1::bigint],
  'TC-02: member can see own workspace preconditions'
);
RESET ROLE;

-- TC-03: Workspace isolation — cannot SELECT other workspace
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000004", "workspace_id": "a0000000-0000-0000-0000-000000000002", "role": "owner"}', false);
SELECT results_eq(
  $$ SELECT count(*) FROM trust_preconditions WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' $$,
  ARRAY[0::bigint],
  'TC-03: cannot see other workspace preconditions'
);
RESET ROLE;

-- TC-04: Owner can INSERT preconditions
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000001", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "owner"}', false);
SELECT lives_ok(
  $$ INSERT INTO trust_preconditions (workspace_id, agent_id, action_type, condition_key, condition_expr) VALUES ('a0000000-0000-0000-0000-000000000001', 'calendar', 'general', 'workday', 'day_of_week IN (1,2,3,4,5)') $$,
  'TC-04: owner can insert precondition'
);
RESET ROLE;

-- TC-05: Member cannot INSERT preconditions
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000003", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "member"}', false);
SELECT throws_ok(
  $$ INSERT INTO trust_preconditions (workspace_id, agent_id, action_type, condition_key, condition_expr) VALUES ('a0000000-0000-0000-0000-000000000001', 'inbox', 'general', 'unauthorized', 'true') $$,
  '42501'
);
SELECT is(
  (SELECT count(*) FROM trust_preconditions WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND condition_key = 'unauthorized'),
  0::bigint,
  'TC-05: member insert was blocked'
);
RESET ROLE;

-- TC-06: Admin can INSERT preconditions
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000002", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "admin"}', false);
SELECT lives_ok(
  $$ INSERT INTO trust_preconditions (workspace_id, agent_id, action_type, condition_key, condition_expr) VALUES ('a0000000-0000-0000-0000-000000000001', 'inbox', 'general', 'vip_client', 'client_tier = ''vip''') $$,
  'TC-06: admin can insert precondition'
);
RESET ROLE;

-- TC-07: Owner can DELETE own workspace preconditions
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000001", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "owner"}', false);
SELECT lives_ok(
  $$ DELETE FROM trust_preconditions WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND condition_key = 'business_hours' $$,
  'TC-07: owner can delete precondition'
);
RESET ROLE;

-- TC-08: Member cannot DELETE
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000003", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "member"}', false);
SELECT throws_ok(
  $$ DELETE FROM trust_preconditions WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' $$,
  '42501'
);
SELECT is(
  (SELECT count(*) FROM trust_preconditions WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'),
  2::bigint,
  'TC-08: member delete was blocked'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
