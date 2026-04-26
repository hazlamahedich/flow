-- RLS tests for agent_runs corrections (Story 2.7)
-- Run: PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/tests/rls_agent_runs_corrections.sql

BEGIN;

SELECT plan(8);

SELECT has_column('agent_runs', 'corrected_run_id');
SELECT has_column('agent_runs', 'correction_depth');
SELECT has_column('agent_runs', 'correction_issued');
SELECT has_column('agent_runs', 'source');

-- Test 1: correction_depth CHECK rejects > 5
SELECT throws_ok(
  $$INSERT INTO agent_runs (workspace_id, agent_id, job_id, action_type, correlation_id, correction_depth, source) VALUES (gen_random_uuid(), 'inbox', 'j-test', 'test', gen_random_uuid(), 6, 'agent')$$,
  '23514',
  'correction_depth CHECK enforced (reject > 5)'
);

-- Test 2: source enum validated
SELECT throws_ok(
  $$INSERT INTO agent_runs (workspace_id, agent_id, job_id, action_type, correlation_id, source) VALUES (gen_random_uuid(), 'inbox', 'j-test', 'test', gen_random_uuid(), 'invalid_source')$$,
  '22P02',
  'source enum validated'
);

-- Test 3: default values correct
SELECT results_eq(
  $$SELECT correction_depth = 0 AND correction_issued = false AND source = 'agent' FROM agent_runs LIMIT 1$$,
  ARRAY[true],
  'default values: depth=0, issued=false, source=agent'
);

-- Test 4: agent_run_source enum exists with correct values
SELECT results_eq(
  $$SELECT enumlabel FROM pg_enum WHERE enumtypid = 'agent_run_source'::regtype ORDER BY enumlabel$$,
  ARRAY['agent', 'human_correction'],
  'agent_run_source enum has correct values'
);

SELECT finish();
ROLLBACK;
