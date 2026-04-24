-- pgTAP RLS tests: agent_configurations table
-- Purpose: Verify agent_configurations RLS policies with role-based access and workspace isolation
-- Related: Story 2.2 AC#13 — P0 gate, all tests must pass

BEGIN;

SELECT plan(14);

-- Setup: workspaces, users, memberships
INSERT INTO workspaces (id, name, slug) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'WS Alpha', 'pgtap-ac-alpha'),
  ('a0000000-0000-0000-0000-000000000002', 'WS Beta', 'pgtap-ac-beta')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'owner-a@pgtap.test'),
  ('b0000000-0000-0000-0000-000000000002', 'admin-a@pgtap.test'),
  ('b0000000-0000-0000-0000-000000000003', 'member-a@pgtap.test'),
  ('b0000000-0000-0000-0000-000000000004', 'owner-b@pgtap.test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'owner'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'admin'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'member'),
  ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000004', 'owner')
ON CONFLICT DO NOTHING;

-- Seed agent_configurations as service_role
INSERT INTO agent_configurations (workspace_id, agent_id, status, setup_completed)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'inbox', 'active', true),
  ('a0000000-0000-0000-0000-000000000001', 'calendar', 'inactive', false),
  ('a0000000-0000-0000-0000-000000000002', 'inbox', 'inactive', false)
ON CONFLICT DO NOTHING;

-- TC-01: Owner can SELECT own workspace configurations
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000001", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "owner"}', false);
SELECT results_eq(
  $$ SELECT count(*) FROM agent_configurations WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' $$,
  ARRAY[2::bigint],
  'TC-01: owner can see own workspace configs'
);
RESET ROLE;

-- TC-02: Member can SELECT own workspace configurations
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000003", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "member"}', false);
SELECT results_eq(
  $$ SELECT count(*) FROM agent_configurations WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' $$,
  ARRAY[2::bigint],
  'TC-02: member can see own workspace configs'
);
RESET ROLE;

-- TC-03: Workspace isolation — cannot SELECT other workspace
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000004", "workspace_id": "a0000000-0000-0000-0000-000000000002", "role": "owner"}', false);
SELECT results_eq(
  $$ SELECT count(*) FROM agent_configurations WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' $$,
  ARRAY[0::bigint],
  'TC-03: cannot see other workspace configs'
);
RESET ROLE;

-- TC-04: Owner can INSERT into own workspace
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000001", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "owner"}', false);
SELECT lives_ok(
  $$ INSERT INTO agent_configurations (workspace_id, agent_id, status, setup_completed) VALUES ('a0000000-0000-0000-0000-000000000001', 'ar-collection', 'inactive', false) $$,
  'TC-04: owner can insert config'
);
RESET ROLE;

-- TC-05: Admin can INSERT into own workspace
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000002", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "admin"}', false);
SELECT lives_ok(
  $$ INSERT INTO agent_configurations (workspace_id, agent_id, status, setup_completed) VALUES ('a0000000-0000-0000-0000-000000000001', 'weekly-report', 'inactive', false) $$,
  'TC-05: admin can insert config'
);
RESET ROLE;

-- TC-06: Member cannot INSERT
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000003", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "member"}', false);
SELECT throws_ok(
  $$ INSERT INTO agent_configurations (workspace_id, agent_id, status, setup_completed) VALUES ('a0000000-0000-0000-0000-000000000001', 'client-health', 'inactive', false) $$,
  '42501',
  NULL,
  'TC-06: member cannot insert config'
);
RESET ROLE;

-- TC-07: Owner can UPDATE own workspace config
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000001", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "owner"}', false);
SELECT lives_ok(
  $$ UPDATE agent_configurations SET schedule = '{"type":"manual"}' WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND agent_id = 'inbox' $$,
  'TC-07: owner can update config'
);
RESET ROLE;

-- TC-08: Admin can UPDATE own workspace config
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000002", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "admin"}', false);
SELECT lives_ok(
  $$ UPDATE agent_configurations SET trigger_config = '{"onNewEmail":true}' WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND agent_id = 'calendar' $$,
  'TC-08: admin can update config'
);
RESET ROLE;

-- TC-09: Member cannot UPDATE
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000003", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "member"}', false);
SELECT throws_ok(
  $$ UPDATE agent_configurations SET schedule = '{}' WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND agent_id = 'inbox' $$,
  '42501',
  NULL,
  'TC-09: member cannot update config'
);
RESET ROLE;

-- TC-10: No DELETE for anyone (even owner)
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000001", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "owner"}', false);
SELECT throws_ok(
  $$ DELETE FROM agent_configurations WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND agent_id = 'inbox' $$,
  '42501',
  NULL,
  'TC-10: owner cannot delete config'
);
RESET ROLE;

-- TC-11: ::text cast required — wrong workspace_id format returns nothing
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000001", "workspace_id": "wrong-format", "role": "owner"}', false);
SELECT results_eq(
  $$ SELECT count(*) FROM agent_configurations $$,
  ARRAY[0::bigint],
  'TC-11: wrong workspace_id format returns zero rows'
);
RESET ROLE;

-- TC-12: Cannot INSERT into other workspace even as owner
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000001", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "owner"}', false);
SELECT throws_ok(
  $$ INSERT INTO agent_configurations (workspace_id, agent_id, status, setup_completed) VALUES ('a0000000-0000-0000-0000-000000000002', 'inbox', 'inactive', false) $$,
  '42501',
  NULL,
  'TC-12: cannot insert into other workspace'
);
RESET ROLE;

-- TC-13: CHECK constraint blocks activation without setup_completed
SELECT throws_ok(
  $$ INSERT INTO agent_configurations (workspace_id, agent_id, status, setup_completed) VALUES ('a0000000-0000-0000-0000-000000000001', 'time-integrity', 'active', false) $$,
  '23514',
  NULL,
  'TC-13: CHECK blocks active status when setup_completed = false'
);

-- TC-14: service_role bypasses all RLS
SET ROLE service_role;
SELECT results_eq(
  $$ SELECT count(*) FROM agent_configurations $$,
  ARRAY[5::bigint],
  'TC-14: service_role sees all configs across workspaces'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
