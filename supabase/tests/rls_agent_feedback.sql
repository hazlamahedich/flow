-- RLS tests for agent_feedback (Story 2.7)
-- Run: PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/tests/rls_agent_feedback.sql

BEGIN;

SELECT plan(7);

-- Deterministic setup
SET ROLE postgres;

INSERT INTO workspaces (id, name, slug) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Agent Feedback WS', 'pgtap-agent-feedback')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'owner-a@pgtap.test', '{}', now(), now()),
  ('b0000000-0000-0000-0000-000000000002', 'member-a@pgtap.test', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, name) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'owner-a@pgtap.test', 'Owner'),
  ('b0000000-0000-0000-0000-000000000002', 'member-a@pgtap.test', 'Member')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'owner'),
  ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'member')
ON CONFLICT DO NOTHING;

INSERT INTO agent_runs (id, workspace_id, agent_id, source, status, job_id, action_type, input, correlation_id)
VALUES (
  'c0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'inbox',
  'agent',
  'completed',
  gen_random_uuid(),
  'process_inbox',
  '{}',
  gen_random_uuid()
);

RESET ROLE;

-- Test 1: member can INSERT own workspace feedback
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000002", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "member"}', false);
SELECT lives_ok(
  $$INSERT INTO agent_feedback (workspace_id, run_id, user_id, sentiment) VALUES ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'positive')$$,
  'member can INSERT own workspace feedback'
);
RESET ROLE;

-- Test 2: member can UPDATE own feedback
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000002", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "member"}', false);
SELECT lives_ok(
  $$UPDATE agent_feedback SET note = 'updated' WHERE run_id = 'c0000000-0000-0000-0000-000000000001' AND user_id = 'b0000000-0000-0000-0000-000000000002'$$,
  'member can UPDATE own feedback'
);
RESET ROLE;

-- Test 3: member SELECT own workspace feedback
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000002", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "member"}', false);
SELECT is(
  (SELECT count(*) FROM agent_feedback WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'),
  1::bigint,
  'member can SELECT own workspace feedback'
);
RESET ROLE;

-- Test 4: owner can DELETE feedback
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000001", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "owner"}', false);
SELECT lives_ok(
  $$DELETE FROM agent_feedback WHERE workspace_id = 'a0000000-0000-0000-0000-000000000001'$$,
  'owner/admin can DELETE feedback'
);
RESET ROLE;

-- Test 5: unique constraint on run_id + user_id
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000002", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "member"}', false);
INSERT INTO agent_feedback (workspace_id, run_id, user_id, sentiment)
VALUES ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'positive');
SELECT throws_ok(
  $$INSERT INTO agent_feedback (workspace_id, run_id, user_id, sentiment) VALUES ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'negative')$$,
  '23505'
);
RESET ROLE;

-- Test 6: updated_at trigger fires on update
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "b0000000-0000-0000-0000-000000000002", "workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "member"}', false);
UPDATE agent_feedback SET note = 'trigger test' WHERE run_id = 'c0000000-0000-0000-0000-000000000001' AND user_id = 'b0000000-0000-0000-0000-000000000002';
SELECT ok(
  (SELECT updated_at IS NOT NULL FROM agent_feedback WHERE run_id = 'c0000000-0000-0000-0000-000000000001' AND user_id = 'b0000000-0000-0000-0000-000000000002'),
  'updated_at is not null after update'
);
RESET ROLE;

-- Test 7: unauthenticated denial
SET ROLE anon;
SELECT throws_ok(
  $$INSERT INTO agent_feedback (workspace_id, run_id, user_id, sentiment) VALUES ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'positive')$$,
  '42501'
);
RESET ROLE;

SELECT finish();
ROLLBACK;
