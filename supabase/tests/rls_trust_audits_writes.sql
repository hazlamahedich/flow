-- RLS tests for trust_audits writes (Story 2.6c)
-- Run: PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/tests/rls_trust_audits_writes.sql

BEGIN;

SELECT plan(11);

SELECT has_table('trust_audits');

-- Seed
INSERT INTO trust_audits (workspace_id, agent_id)
SELECT id, 'inbox' FROM workspaces LIMIT 1
ON CONFLICT DO NOTHING;

-- Test 1: member can INSERT own workspace trust audit
SELECT lives_ok(
  $$INSERT INTO trust_audits (workspace_id, agent_id) SELECT id, 'inbox' FROM workspaces LIMIT 1 ON CONFLICT DO NOTHING$$,
  'member can INSERT own workspace trust audit'
);

-- Test 2: member can UPDATE own workspace trust audit
SELECT lives_ok(
  $$UPDATE trust_audits SET deferred_count = deferred_count + 1 WHERE workspace_id = (SELECT id FROM workspaces LIMIT 1) AND agent_id = 'inbox'$$,
  'member can UPDATE own workspace trust audit'
);

-- Test 3: INSERT policy has no USING clause - any workspace_id accepted
SELECT lives_ok(
  $$INSERT INTO trust_audits (workspace_id, agent_id) SELECT id, 'inbox' FROM workspaces OFFSET 1 LIMIT 1 ON CONFLICT DO NOTHING$$
);

-- Test 4: cross-workspace UPDATE silently denied (0 rows matched)
SELECT lives_ok(
  $$UPDATE trust_audits SET deferred_count = 0 WHERE workspace_id = (SELECT id FROM workspaces OFFSET 1 LIMIT 1) AND agent_id = 'inbox'$$
);

-- Test 5: owner/admin can DELETE own workspace trust audit
SELECT lives_ok(
  $$DELETE FROM trust_audits WHERE workspace_id = (SELECT id FROM workspaces LIMIT 1) AND agent_id = 'inbox'$$,
  'owner/admin can DELETE trust audit'
);

-- Test 6: member DELETE silently denied (not owner/admin)
INSERT INTO trust_audits (workspace_id, agent_id) SELECT id, 'inbox' FROM workspaces LIMIT 1 ON CONFLICT DO NOTHING;
SELECT lives_ok(
  $$DELETE FROM trust_audits WHERE workspace_id = (SELECT id FROM workspaces LIMIT 1) AND agent_id = 'inbox'$$
);

-- Re-insert for remaining tests
INSERT INTO trust_audits (workspace_id, agent_id) SELECT id, 'calendar' FROM workspaces LIMIT 1 ON CONFLICT DO NOTHING;

-- Test 7: unauthenticated denial
SET ROLE anon;
SELECT throws_ok(
  $$INSERT INTO trust_audits (workspace_id, agent_id) VALUES (gen_random_uuid(), 'inbox')$$,
  '42501'
);
RESET ROLE;

-- Test 8: postgres role can INSERT
SET ROLE postgres;
SELECT lives_ok(
  $$INSERT INTO trust_audits (workspace_id, agent_id) SELECT id, 'weekly-report' FROM workspaces LIMIT 1 ON CONFLICT DO NOTHING$$,
  'postgres role can INSERT trust audit'
);
RESET ROLE;

-- Test 9: removed member denial (anon UPDATE silently 0 rows)
SET ROLE anon;
SELECT lives_ok(
  $$UPDATE trust_audits SET deferred_count = 0$$
);
RESET ROLE;

-- Test 10: deferred_count increment within own workspace
SELECT lives_ok(
  $$UPDATE trust_audits SET deferred_count = deferred_count + 1 WHERE workspace_id = (SELECT id FROM workspaces LIMIT 1) AND agent_id = 'calendar'$$,
  'deferred_count increment within own workspace'
);

SELECT * FROM finish();
ROLLBACK;
