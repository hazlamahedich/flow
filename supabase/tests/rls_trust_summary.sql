-- pgTAP RLS tests: trust_audits and trust_milestones tables
-- Purpose: Verify RLS policies for trust audit/milestone tables with workspace isolation
-- Related: Story 2.6a AC — trust badge display & agent status indicators

BEGIN;

SELECT plan(20);

INSERT INTO workspaces (id, name, slug) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'WS Alpha', 'pgtap-ta-alpha'),
  ('a0000000-0000-0000-0000-000000000002', 'WS Beta', 'pgtap-ta-beta')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'owner-a@pgtap-ta.test', '{}', '{}'),
  ('b0000000-0000-0000-0000-000000000002', 'admin-a@pgtap-ta.test', '{}', '{}'),
  ('b0000000-0000-0000-0000-000000000003', 'member-a@pgtap-ta.test', '{}', '{}'),
  ('b0000000-0000-0000-0000-000000000004', 'owner-b@pgtap-ta.test', '{}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'owner-a@pgtap-ta.test'),
  ('b0000000-0000-0000-0000-000000000002', 'admin-a@pgtap-ta.test'),
  ('b0000000-0000-0000-0000-000000000003', 'member-a@pgtap-ta.test'),
  ('b0000000-0000-0000-0000-000000000004', 'owner-b@pgtap-ta.test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'owner'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'admin'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000003', 'member'),
  ('a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000004', 'owner')
ON CONFLICT DO NOTHING;

INSERT INTO trust_audits (workspace_id, agent_id, review_count) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'inbox', 5),
  ('a0000000-0000-0000-0000-000000000001', 'calendar', 3),
  ('a0000000-0000-0000-0000-000000000002', 'inbox', 10)
ON CONFLICT (workspace_id, agent_id) DO NOTHING;

INSERT INTO trust_milestones (workspace_id, agent_id, milestone_type, threshold) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'inbox', 'first_execution', 1),
  ('a0000000-0000-0000-0000-000000000001', 'calendar', 'seven_consecutive', 7),
  ('a0000000-0000-0000-0000-000000000002', 'inbox', 'first_execution', 1)
ON CONFLICT (workspace_id, agent_id, milestone_type) DO NOTHING;

-- TC-01: Owner can SELECT own workspace trust_audits
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000001", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "owner"}', false);
SELECT results_eq(
  $$ SELECT count(*) FROM trust_audits WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' $$,
  ARRAY[2::bigint],
  'TC-01: owner can see own workspace trust_audits'
);
RESET ROLE;

-- TC-02: Admin can SELECT own workspace trust_audits
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000002", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "admin"}', false);
SELECT results_eq(
  $$ SELECT count(*) FROM trust_audits WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' $$,
  ARRAY[2::bigint],
  'TC-02: admin can see own workspace trust_audits'
);
RESET ROLE;

-- TC-03: Member can SELECT own workspace trust_audits
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000003", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "member"}', false);
SELECT results_eq(
  $$ SELECT count(*) FROM trust_audits WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' $$,
  ARRAY[2::bigint],
  'TC-03: member can see own workspace trust_audits'
);
RESET ROLE;

-- TC-04: Cross-workspace isolation for trust_audits
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000001", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "owner"}', false);
SELECT results_eq(
  $$ SELECT count(*) FROM trust_audits WHERE workspace_id = 'a0000000-0000-0000-0000-000000000002' $$,
  ARRAY[0::bigint],
  'TC-04: cannot see other workspace trust_audits'
);
RESET ROLE;

-- TC-05: Unauthenticated denied from trust_audits
SET ROLE anon;
SELECT is_empty(
  $$ SELECT * FROM trust_audits $$,
  'TC-05: unauthenticated cannot see trust_audits'
);
RESET ROLE;

-- TC-06: Owner can SELECT own workspace trust_milestones
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000001", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "owner"}', false);
SELECT results_eq(
  $$ SELECT count(*) FROM trust_milestones WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' $$,
  ARRAY[2::bigint],
  'TC-06: owner can see own workspace trust_milestones'
);
RESET ROLE;

-- TC-07: Cross-workspace isolation for trust_milestones
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000001", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "owner"}', false);
SELECT results_eq(
  $$ SELECT count(*) FROM trust_milestones WHERE workspace_id = 'a0000000-0000-0000-0000-000000000002' $$,
  ARRAY[0::bigint],
  'TC-07: cannot see other workspace trust_milestones'
);
RESET ROLE;

-- TC-08: Unauthenticated denied from trust_milestones
SET ROLE anon;
SELECT is_empty(
  $$ SELECT * FROM trust_milestones $$,
  'TC-08: unauthenticated cannot see trust_milestones'
);
RESET ROLE;

-- TC-09: Member can INSERT trust_audit in own workspace
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000003", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "member"}', false);
SELECT lives_ok(
  $$ INSERT INTO trust_audits (workspace_id, agent_id, review_count) VALUES ('a0000000-0000-0000-0000-000000000001', 'weekly-report', 1) ON CONFLICT (workspace_id, agent_id) DO NOTHING $$,
  'TC-09: member can insert trust_audit in own workspace'
);
RESET ROLE;

-- TC-10: Member cannot INSERT trust_audit in other workspace
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000001", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "owner"}', false);
SELECT throws_ok(
  $$ INSERT INTO trust_audits (workspace_id, agent_id, review_count) VALUES ('a0000000-0000-0000-0000-000000000002', 'calendar', 1) $$,
  '42501'
);
RESET ROLE;

-- TC-11: Member can INSERT trust_milestone in own workspace
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000003", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "member"}', false);
SELECT lives_ok(
  $$ INSERT INTO trust_milestones (workspace_id, agent_id, milestone_type, threshold) VALUES ('a0000000-0000-0000-0000-000000000001', 'weekly-report', 'twenty_executions', 50) ON CONFLICT (workspace_id, agent_id, milestone_type) DO NOTHING $$,
  'TC-11: member can insert trust_milestone in own workspace'
);
RESET ROLE;

-- TC-12: Member cannot INSERT trust_milestone in other workspace
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000001", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "owner"}', false);
SELECT throws_ok(
  $$ INSERT INTO trust_milestones (workspace_id, agent_id, milestone_type, threshold) VALUES ('a0000000-0000-0000-0000-000000000002', 'calendar', 'twenty_executions', 50) $$,
  '42501'
);
RESET ROLE;

-- TC-13: Owner can UPDATE trust_audit in own workspace
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000001", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "owner"}', false);
SELECT lives_ok(
  $$ UPDATE trust_audits SET review_count = review_count + 1 WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND agent_id = 'inbox' $$,
  'TC-13: owner can update trust_audit in own workspace'
);
RESET ROLE;

-- TC-14: Owner can UPDATE trust_milestone in own workspace
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000001", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "owner"}', false);
SELECT lives_ok(
  $$ UPDATE trust_milestones SET acknowledged_at = now() WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND agent_id = 'inbox' AND acknowledged_at IS NULL $$,
  'TC-14: owner can acknowledge trust_milestone'
);
RESET ROLE;

-- TC-15: Member cannot DELETE trust_audit (owner/admin only — silently affects 0 rows)
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000003", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "member"}', false);
SELECT lives_ok(
  $$ DELETE FROM trust_audits WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND agent_id = 'inbox' $$,
  'TC-15: member delete of trust_audit runs but affects 0 rows'
);
RESET ROLE;
-- Verify the row still exists
SET ROLE postgres;
SELECT is(
  (SELECT count(*) FROM trust_audits WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND agent_id = 'inbox'),
  1::bigint,
  'TC-15b: trust_audit row survives member delete'
);
RESET ROLE;

-- TC-16: Owner can DELETE trust_audit in own workspace
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000001", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "owner"}', false);
SELECT lives_ok(
  $$ DELETE FROM trust_audits WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' AND agent_id = 'calendar' $$,
  'TC-16: owner can delete trust_audit in own workspace'
);
RESET ROLE;

-- TC-17: Cannot UPDATE trust_audit in other workspace (silently affects 0 rows)
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000001", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "owner"}', false);
SELECT lives_ok(
  $$ UPDATE trust_audits SET review_count = review_count + 1 WHERE workspace_id = 'a0000000-0000-0000-0000-000000000002' AND agent_id = 'inbox' $$,
  'TC-17: cross-workspace trust_audit update runs but affects 0 rows'
);
RESET ROLE;

-- TC-18: Cannot UPDATE trust_milestone in other workspace (silently affects 0 rows)
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000001", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "owner"}', false);
SELECT lives_ok(
  $$ UPDATE trust_milestones SET acknowledged_at = now() WHERE workspace_id = 'a0000000-0000-0000-0000-000000000002' AND agent_id = 'inbox' $$,
  'TC-18: cross-workspace trust_milestone update runs but affects 0 rows'
);
RESET ROLE;

-- TC-19: Removed member denied access
DELETE FROM workspace_members WHERE user_id = 'b0000000-0000-0000-0000-000000000003' AND workspace_id = 'a0000000-0000-0000-0000-000000000001';
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000003", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "member"}', false);
SELECT results_eq(
  $$ SELECT count(*) FROM trust_audits WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001' $$,
  ARRAY[0::bigint],
  'TC-19: removed member cannot see trust_audits'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
