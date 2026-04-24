-- pgTAP RLS tests: trust_matrix table
-- Purpose: Verify trust_matrix RLS policies with role-based access and workspace isolation
-- Related: Story 2.3 AC#1,#3,#5,#9 — P0 gate, all tests must pass

BEGIN;

SELECT plan(12);

INSERT INTO workspaces (id, name, slug) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'WS Alpha', 'pgtap-tm-alpha'),
  ('a0000000-0000-0000-0000-000000000002', 'WS Beta', 'pgtap-tm-beta')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'owner-a@pgtap-tm.test', '{}', '{}'),
  ('b0000000-0000-0000-0000-000000000002', 'admin-a@pgtap-tm.test', '{}', '{}'),
  ('b0000000-0000-0000-0000-000000000003', 'member-a@pgtap-tm.test', '{}', '{}'),
  ('b0000000-0000-0000-0000-000000000004', 'owner-b@pgtap-tm.test', '{}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'owner-a@pgtap-tm.test'),
  ('b0000000-0000-0000-0000-000000000002', 'admin-a@pgtap-tm.test'),
  ('b0000000-0000-0000-0000-000000000003', 'member-a@pgtap-tm.test'),
  ('b0000000-0000-0000-0000-000000000004', 'owner-b@pgtap-tm.test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'owner'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'admin'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'member'),
  ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000004', 'owner')
ON CONFLICT DO NOTHING;

INSERT INTO trust_matrix (workspace_id, agent_id, action_type, current_level, score, version) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'inbox', 'general', 'supervised', 50, 1),
  ('a0000000-0000-0000-0000-000000000001', 'calendar', 'general', 'confirm', 120, 1),
  ('a0000000-0000-0000-0000-000000000002', 'inbox', 'general', 'auto', 180, 1)
ON CONFLICT DO NOTHING;

-- TC-01: Owner can SELECT own workspace
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000001", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "owner"}', false);
SELECT results_eq(
  $$ SELECT count(*) FROM trust_matrix WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' $$,
  ARRAY[2::bigint],
  'TC-01: owner can see own workspace trust entries'
);
RESET ROLE;

-- TC-02: Member can SELECT own workspace
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000003", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "member"}', false);
SELECT results_eq(
  $$ SELECT count(*) FROM trust_matrix WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' $$,
  ARRAY[2::bigint],
  'TC-02: member can see own workspace trust entries'
);
RESET ROLE;

-- TC-03: Workspace isolation — cannot SELECT other workspace
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000004", "workspace_id": "a0000000-0000-0000-0000-000000000002", "role": "owner"}', false);
SELECT results_eq(
  $$ SELECT count(*) FROM trust_matrix WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' $$,
  ARRAY[0::bigint],
  'TC-03: cannot see other workspace trust entries'
);
RESET ROLE;

-- TC-04: Owner can INSERT into own workspace
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000001", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "owner"}', false);
SELECT lives_ok(
  $$ INSERT INTO trust_matrix (workspace_id, agent_id, action_type, current_level, score, version) VALUES ('a0000000-0000-0000-0000-000000000001', 'ar-collection', 'general', 'supervised', 0, 1) $$,
  'TC-04: owner can insert trust entry'
);
RESET ROLE;

-- TC-05: Admin can INSERT into own workspace
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000002", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "admin"}', false);
SELECT lives_ok(
  $$ INSERT INTO trust_matrix (workspace_id, agent_id, action_type, current_level, score, version) VALUES ('a0000000-0000-0000-0000-000000000001', 'weekly-report', 'general', 'supervised', 0, 1) $$,
  'TC-05: admin can insert trust entry'
);
RESET ROLE;

-- TC-06: Member cannot INSERT (WITH CHECK fails → error)
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000003", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "member"}', false);
SELECT throws_ok(
  $$ INSERT INTO trust_matrix (workspace_id, agent_id, action_type, current_level, score, version) VALUES ('a0000000-0000-0000-0000-000000000001', 'client-health', 'general', 'supervised', 0, 1) $$,
  '42501'
);
RESET ROLE;

-- TC-07: Owner can UPDATE own workspace
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000001", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "owner"}', false);
SELECT lives_ok(
  $$ UPDATE trust_matrix SET current_level = 'confirm', score = 80, version = 2 WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND agent_id = 'inbox' $$,
  'TC-07: owner can update trust entry'
);
RESET ROLE;

-- TC-08: Member cannot UPDATE (rows filtered out by RLS USING clause)
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000003", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "member"}', false);
SELECT lives_ok(
  $$ UPDATE trust_matrix SET current_level = 'auto' WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND agent_id = 'inbox' $$,
  'TC-08a: member update does not throw'
);
SELECT is(
  (SELECT current_level FROM trust_matrix WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND agent_id = 'inbox'),
  'confirm',
  'TC-08b: member update had no effect'
);
RESET ROLE;

-- TC-09: Cannot UPDATE other workspace (rows filtered by RLS)
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000004", "workspace_id": "a0000000-0000-0000-0000-000000000002", "role": "owner"}', false);
SELECT lives_ok(
  $$ UPDATE trust_matrix SET score = 199 WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND agent_id = 'inbox' $$,
  'TC-09a: cross-workspace update does not throw'
);
SELECT is(
  (SELECT score FROM trust_matrix WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND agent_id = 'inbox'),
  80,
  'TC-09b: cross-workspace update had no effect'
);
RESET ROLE;

-- TC-10: service_role bypasses RLS
SELECT results_eq(
  $$ SELECT count(*) FROM trust_matrix $$,
  ARRAY[5::bigint],
  'TC-10: service_role sees all trust entries'
);

-- TC-11: Score range — negative rejected
SELECT throws_ok(
  $$ INSERT INTO trust_matrix (workspace_id, agent_id, action_type, current_level, score, version) VALUES ('a0000000-0000-0000-0000-000000000001', 'time-integrity', 'general', 'supervised', -1, 1) $$,
  '23514'
);

-- TC-12: Score range — >200 rejected
SELECT throws_ok(
  $$ INSERT INTO trust_matrix (workspace_id, agent_id, action_type, current_level, score, version) VALUES ('a0000000-0000-0000-0000-000000000001', 'time-integrity', 'general', 'supervised', 201, 1) $$,
  '23514'
);

SELECT * FROM finish();
ROLLBACK;
