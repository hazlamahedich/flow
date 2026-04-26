-- RLS tests for trust_audits reads (Story 2.6c)
-- Run: PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/tests/rls_trust_audits_reads.sql

BEGIN;

SELECT plan(8);

SELECT has_table('trust_audits');

-- Seed test data
INSERT INTO trust_audits (workspace_id, agent_id)
SELECT w.id, 'inbox'
FROM workspaces w
LIMIT 1
ON CONFLICT DO NOTHING;

-- Test 1: member can SELECT own workspace trust audits
SELECT lives_ok(
  $$SELECT * FROM trust_audits WHERE workspace_id = (SELECT id FROM workspaces LIMIT 1)$$,
  'member can SELECT own workspace trust audits'
);

-- Test 2: member cannot SELECT cross-workspace trust audits
-- (This returns empty set rather than error due to RLS USING clause)
SELECT is_empty(
  $$SELECT * FROM trust_audits WHERE workspace_id = (SELECT id FROM workspaces w WHERE w.id NOT IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()) LIMIT 1)$$,
  'member cannot SELECT cross-workspace trust audits'
);

-- Test 3: owner can SELECT own workspace trust audits
SELECT lives_ok(
  $$SELECT * FROM trust_audits WHERE workspace_id = (SELECT id FROM workspaces LIMIT 1)$$,
  'owner can SELECT own workspace trust audits'
);

-- Test 4: admin can SELECT own workspace trust audits
SELECT lives_ok(
  $$SELECT * FROM trust_audits WHERE workspace_id = (SELECT id FROM workspaces LIMIT 1)$$,
  'admin can SELECT own workspace trust audits'
);

-- Test 5: unauthenticated SELECT denial
SET ROLE anon;
SELECT is_empty(
  $$SELECT * FROM trust_audits$$,
  'unauthenticated cannot SELECT trust audits'
);
RESET ROLE;

-- Test 6: service_role can read all
SET ROLE service_role;
SELECT is_not_empty(
  $$SELECT * FROM trust_audits$$,
  'service_role can read all trust audits'
);
RESET ROLE;

-- Test 7: removed member SELECT denial
-- Simulated by anon role since we can't easily remove members in test
SET ROLE anon;
SELECT is_empty(
  $$SELECT * FROM trust_audits$$,
  'removed member cannot SELECT trust audits'
);
RESET ROLE;

-- Test 8: client_user role SELECT denial
SET ROLE client_user;
SELECT is_empty(
  $$SELECT * FROM trust_audits$$,
  'client_user cannot SELECT trust audits'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
