-- RLS tests for agent_feedback (Story 2.7)
-- Run: PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/tests/rls_agent_feedback.sql

BEGIN;

SELECT plan(12);

SELECT has_table('agent_feedback');

CREATE TEMP TABLE IF NOT EXISTS _test_setup (
  workspace_id uuid,
  member_id uuid,
  other_workspace_id uuid,
  other_member_id uuid
);

INSERT INTO _test_setup
SELECT
  w1.id,
  wm1.user_id,
  w2.id,
  wm2.user_id
FROM (
  SELECT id FROM workspaces LIMIT 1
) w1,
(
  SELECT user_id, workspace_id FROM workspace_members WHERE workspace_id = w1.id LIMIT 1
) wm1,
(
  SELECT id FROM workspaces WHERE id != w1.id LIMIT 1
) w2,
(
  SELECT user_id, workspace_id FROM workspace_members WHERE workspace_id = w2.id LIMIT 1
) wm2
WHERE w1.id IS NOT NULL AND w2.id IS NOT NULL;

-- Test 1: member can INSERT own workspace feedback
SELECT lives_ok(
  $$INSERT INTO agent_feedback (workspace_id, run_id, user_id, sentiment) SELECT workspace_id, (SELECT id FROM agent_runs WHERE workspace_id = workspace_id LIMIT 1), member_id, 'positive' FROM _test_setup$$,
  'member can INSERT own workspace feedback'
);

-- Test 2: member can UPDATE own feedback
SELECT lives_ok(
  $$UPDATE agent_feedback SET note = 'updated' WHERE user_id = (SELECT member_id FROM _test_setup) AND sentiment = 'positive'$$,
  'member can UPDATE own feedback'
);

-- Test 3: member cannot INSERT cross-workspace feedback
SELECT throws_ok(
  $$INSERT INTO agent_feedback (workspace_id, run_id, user_id, sentiment) SELECT other_workspace_id, gen_random_uuid(), (SELECT member_id FROM _test_setup), 'negative' FROM _test_setup$$,
  '42501',
  'member cannot INSERT cross-workspace feedback'
);

-- Test 4: member SELECT own workspace feedback
SELECT lives_ok(
  $$SELECT * FROM agent_feedback WHERE workspace_id = (SELECT workspace_id FROM _test_setup)$$,
  'member can SELECT own workspace feedback'
);

-- Test 5: owner can DELETE feedback
SELECT lives_ok(
  $$DELETE FROM agent_feedback WHERE workspace_id = (SELECT workspace_id FROM _test_setup) AND user_id = (SELECT member_id FROM _test_setup)$$,
  'owner/admin can DELETE feedback'
);

-- Test 6: unique constraint on run_id + user_id
SELECT throws_ok(
  $$INSERT INTO agent_feedback (workspace_id, run_id, user_id, sentiment) SELECT workspace_id, gen_random_uuid(), member_id, 'positive' FROM _test_setup$$,
  '23505',
  'unique constraint enforced on run_id + user_id'
);

-- Test 7: updated_at trigger fires
SELECT results_eq(
  $$SELECT updated_at IS NOT NULL FROM agent_feedback WHERE workspace_id = (SELECT workspace_id FROM _test_setup) LIMIT 1$$,
  ARRAY[true],
  'updated_at trigger fires on update'
);

SELECT finish();
ROLLBACK;
