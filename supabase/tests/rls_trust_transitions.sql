-- pgTAP RLS tests: trust_transitions table
-- Purpose: Verify trust_transitions RLS policies — immutable log, workspace isolation
-- Related: Story 2.3 AC#1,#3,#12 — P0 gate

BEGIN;

SELECT plan(12);

INSERT INTO workspaces (id, name, slug) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'WS Alpha', 'pgtap-tt-alpha'),
  ('a0000000-0000-0000-0000-000000000002', 'WS Beta', 'pgtap-tt-beta')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'owner-a@pgtap-tt.test', '{}', '{}'),
  ('b0000000-0000-0000-0000-000000000003', 'member-a@pgtap-tt.test', '{}', '{}'),
  ('b0000000-0000-0000-0000-000000000004', 'owner-b@pgtap-tt.test', '{}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'owner-a@pgtap-tt.test'),
  ('b0000000-0000-0000-0000-000000000003', 'member-a@pgtap-tt.test'),
  ('b0000000-0000-0000-0000-000000000004', 'owner-b@pgtap-tt.test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'owner'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'member'),
  ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000004', 'owner')
ON CONFLICT DO NOTHING;

INSERT INTO trust_matrix (workspace_id, agent_id, action_type, current_level, score, version) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'inbox', 'general', 'supervised', 50, 1),
  ('a0000000-0000-0000-0000-000000000002', 'inbox', 'general', 'supervised', 50, 1)
ON CONFLICT DO NOTHING;

INSERT INTO trust_transitions (matrix_entry_id, workspace_id, from_level, to_level, trigger_type, trigger_reason, snapshot, actor) VALUES
  ((SELECT id FROM trust_matrix WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND agent_id = 'inbox' LIMIT 1), 'a0000000-0000-0000-0000-000000000001', 'supervised', 'supervised', 'initial', 'Initial trust state', '{}'::jsonb, 'system');

-- TC-01: Owner can SELECT own workspace transitions
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000001", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "owner"}', false);
SELECT results_eq(
  $$ SELECT count(*) FROM trust_transitions WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' $$,
  ARRAY[1::bigint],
  'TC-01: owner can see own workspace transitions'
);
RESET ROLE;

-- TC-02: Member can SELECT own workspace transitions
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000003", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "member"}', false);
SELECT results_eq(
  $$ SELECT count(*) FROM trust_transitions WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' $$,
  ARRAY[1::bigint],
  'TC-02: member can see own workspace transitions'
);
RESET ROLE;

-- TC-03: Workspace isolation
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000004", "workspace_id": "a0000000-0000-0000-0000-000000000002", "role": "owner"}', false);
SELECT results_eq(
  $$ SELECT count(*) FROM trust_transitions WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' $$,
  ARRAY[0::bigint],
  'TC-03: cannot see other workspace transitions'
);
RESET ROLE;

-- TC-04: Owner cannot INSERT (service_role only — WITH CHECK fails)
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000001", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "owner"}', false);
SELECT throws_ok(
  $$ INSERT INTO trust_transitions (matrix_entry_id, workspace_id, from_level, to_level, trigger_type, trigger_reason, snapshot, actor) VALUES ((SELECT id FROM trust_matrix WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND agent_id = 'inbox' LIMIT 1), 'a0000000-0000-0000-0000-000000000001', 'supervised', 'confirm', 'manual_override', 'test', '{}'::jsonb, 'owner') $$,
  '42501'
);
RESET ROLE;

-- TC-05: No UPDATE (0 rows affected — no policy exists)
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000001", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "owner"}', false);
SELECT lives_ok(
  $$ UPDATE trust_transitions SET trigger_reason = 'tampered' WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' $$,
  'TC-05a: update does not throw'
);
SELECT is(
  (SELECT trigger_reason FROM trust_transitions WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' LIMIT 1),
  'Initial trust state',
  'TC-05b: update had no effect'
);
RESET ROLE;

-- TC-06: No DELETE (0 rows affected)
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000001", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "owner"}', false);
SELECT lives_ok(
  $$ DELETE FROM trust_transitions WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' $$,
  'TC-06a: delete does not throw'
);
SELECT is(
  (SELECT count(*) FROM trust_transitions WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'),
  1::bigint,
  'TC-06b: delete had no effect'
);
RESET ROLE;

-- TC-07: service_role can INSERT
SELECT lives_ok(
  $$ INSERT INTO trust_transitions (matrix_entry_id, workspace_id, from_level, to_level, trigger_type, trigger_reason, snapshot, actor) VALUES ((SELECT id FROM trust_matrix WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND agent_id = 'inbox' LIMIT 1), 'a0000000-0000-0000-0000-000000000001', 'supervised', 'confirm', 'score_threshold', 'Score reached threshold', '{"level": "confirm", "score": 70}'::jsonb, 'system') $$,
  'TC-07: service_role can insert transitions'
);

-- TC-08: Verify total transitions
SELECT results_eq(
  $$ SELECT count(*) FROM trust_transitions WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' $$,
  ARRAY[2::bigint],
  'TC-08: two transitions exist'
);

-- TC-09: service_role can UPDATE (owns all)
SELECT lives_ok(
  $$ UPDATE trust_transitions SET trigger_reason = 'modified by service' WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND trigger_type = 'initial' $$,
  'TC-09: service_role can update transitions'
);

-- TC-10: service_role can DELETE
SELECT lives_ok(
  $$ DELETE FROM trust_transitions WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND trigger_type = 'score_threshold' $$,
  'TC-10: service_role can delete transitions'
);

SELECT * FROM finish();
ROLLBACK;
