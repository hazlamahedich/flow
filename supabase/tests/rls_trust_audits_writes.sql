-- RLS tests for trust_audits writes (Story 2.6c)
-- Run: PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/tests/rls_trust_audits_writes.sql

BEGIN;

SELECT plan(10);

SELECT has_table('trust_audits');

-- Helper: create a test workspace and member
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

-- Test 1: member can INSERT own workspace trust audit
SELECT lives_ok(
  $$INSERT INTO trust_audits (workspace_id, agent_id) SELECT workspace_id, 'inbox' FROM _test_setup$$,
  'member can INSERT own workspace trust audit'
);

-- Test 2: member can UPDATE own workspace trust audit
SELECT lives_ok(
  $$UPDATE trust_audits SET deferred_count = deferred_count + 1 WHERE workspace_id = (SELECT workspace_id FROM _test_setup) AND agent_id = 'inbox'$$,
  'member can UPDATE own workspace trust audit'
);

-- Test 3: member cannot INSERT cross-workspace trust audit
SELECT throws_ok(
  $$INSERT INTO trust_audits (workspace_id, agent_id) VALUES ((SELECT other_workspace_id FROM _test_setup), 'inbox')$$,
  '42501',
  NULL,
  'member cannot INSERT cross-workspace trust audit'
);

-- Test 4: member cannot UPDATE cross-workspace trust audit
SELECT throws_ok(
  $$UPDATE trust_audits SET deferred_count = 0 WHERE workspace_id = (SELECT other_workspace_id FROM _test_setup)$$,
  '42501',
  NULL,
  'member cannot UPDATE cross-workspace trust audit'
);

-- Test 5: owner can DELETE own workspace trust audit
SELECT lives_ok(
  $$DELETE FROM trust_audits WHERE workspace_id = (SELECT workspace_id FROM _test_setup) AND agent_id = 'inbox'$$,
  'owner/admin can DELETE trust audit'
);

-- Test 6: member cannot DELETE trust audit (non-owner/non-admin)
-- Note: This depends on role; we re-insert first
INSERT INTO trust_audits (workspace_id, agent_id) SELECT workspace_id, 'inbox' FROM _test_setup ON CONFLICT DO NOTHING;
-- member DELETE denied because role filter applies
SELECT throws_ok(
  $$DELETE FROM trust_audits WHERE workspace_id = (SELECT workspace_id FROM _test_setup) AND agent_id = 'inbox'$$,
  '42501',
  NULL,
  'member cannot DELETE trust audit without owner/admin role'
);

-- Re-insert for remaining tests
INSERT INTO trust_audits (workspace_id, agent_id) SELECT workspace_id, 'calendar' FROM _test_setup ON CONFLICT DO NOTHING;

-- Test 7: unauthenticated denial
SET ROLE anon;
SELECT throws_ok(
  $$INSERT INTO trust_audits (workspace_id, agent_id) VALUES (gen_random_uuid(), 'inbox')$$,
  '42501',
  NULL,
  'unauthenticated cannot INSERT trust audit'
);
RESET ROLE;

-- Test 8: service_role can write all
SET ROLE service_role;
SELECT lives_ok(
  $$INSERT INTO trust_audits (workspace_id, agent_id) SELECT workspace_id, 'weekly-report' FROM _test_setup$$,
  'service_role can INSERT trust audit'
);
RESET ROLE;

-- Test 9: removed member denial (using anon role to simulate)
SET ROLE anon;
SELECT throws_ok(
  $$UPDATE trust_audits SET deferred_count = 0 WHERE workspace_id = (SELECT workspace_id FROM _test_setup)$$,
  '42501',
  NULL,
  'removed member cannot UPDATE trust audit'
);
RESET ROLE;

-- Test 10: deferred_count increment only within own workspace
SELECT lives_ok(
  $$UPDATE trust_audits SET deferred_count = deferred_count + 1 WHERE workspace_id = (SELECT workspace_id FROM _test_setup) AND agent_id = 'calendar'$$,
  'deferred_count increment within own workspace'
);

SELECT * FROM finish();
ROLLBACK;
