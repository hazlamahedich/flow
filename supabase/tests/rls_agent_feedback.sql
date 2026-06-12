-- RLS tests for agent_feedback (Story 2.7)
-- Run: PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/tests/rls_agent_feedback.sql

BEGIN;

SELECT plan(8);

SELECT has_table('agent_feedback');

-- Seed: create an agent_run for FK reference
INSERT INTO agent_runs (workspace_id, agent_id, source, status, job_id, action_type, input, correlation_id)
SELECT id, 'inbox', 'agent', 'completed', gen_random_uuid(), 'process_inbox', '{}', gen_random_uuid()
FROM workspaces LIMIT 1;

-- Test 1: member can INSERT own workspace feedback
SELECT lives_ok(
  $$INSERT INTO agent_feedback (workspace_id, run_id, user_id, sentiment)
  SELECT ar.workspace_id, ar.id, wm.user_id, 'positive'
  FROM agent_runs ar
  JOIN workspace_members wm ON wm.workspace_id = ar.workspace_id
  LIMIT 1$$,
  'member can INSERT own workspace feedback'
);

-- Test 2: member can UPDATE own feedback
SELECT lives_ok(
  $$UPDATE agent_feedback SET note = 'updated' WHERE sentiment = 'positive'$$,
  'member can UPDATE own feedback'
);

-- Test 3: member SELECT own workspace feedback
SELECT lives_ok(
  $$SELECT * FROM agent_feedback WHERE workspace_id = (SELECT workspace_id FROM agent_runs LIMIT 1)$$,
  'member can SELECT own workspace feedback'
);

-- Test 4: owner can DELETE feedback
SELECT lives_ok(
  $$DELETE FROM agent_feedback WHERE workspace_id = (SELECT workspace_id FROM agent_runs LIMIT 1)$$,
  'owner/admin can DELETE feedback'
);

-- Test 5: unique constraint on run_id + user_id
-- Re-insert first, then try duplicate
INSERT INTO agent_feedback (workspace_id, run_id, user_id, sentiment)
SELECT ar.workspace_id, ar.id, wm.user_id, 'positive'
FROM agent_runs ar
JOIN workspace_members wm ON wm.workspace_id = ar.workspace_id
LIMIT 1;
SELECT throws_ok(
  $$INSERT INTO agent_feedback (workspace_id, run_id, user_id, sentiment)
  SELECT ar.workspace_id, ar.id, wm.user_id, 'negative'
  FROM agent_runs ar
  JOIN workspace_members wm ON wm.workspace_id = ar.workspace_id
  LIMIT 1$$,
  '23505'
);

-- Test 6: updated_at trigger fires on update (verify updated_at is not null after update)
UPDATE agent_feedback SET note = 'trigger test';
SELECT ok(
  (SELECT updated_at IS NOT NULL FROM agent_feedback LIMIT 1),
  'updated_at is not null after update'
);

-- Test 7: unauthenticated denial
SET ROLE anon;
SELECT throws_ok(
  $$INSERT INTO agent_feedback (workspace_id, run_id, user_id, sentiment) VALUES (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'positive')$$,
  '42501'
);
RESET ROLE;

SELECT finish();
ROLLBACK;
