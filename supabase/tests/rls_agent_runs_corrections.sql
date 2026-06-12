-- RLS tests for agent_runs corrections (Story 2.7)
-- Run: PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/tests/rls_agent_runs_corrections.sql

BEGIN;

SELECT plan(9);

SELECT has_column('agent_runs', 'corrected_run_id');
SELECT has_column('agent_runs', 'correction_depth');
SELECT has_column('agent_runs', 'correction_issued');
SELECT has_column('agent_runs', 'source');

-- All DML must run as superuser since agent_runs has RLS
SET ROLE postgres;

-- Test 1: correction_depth CHECK rejects > 5
SELECT throws_ok(
  $$INSERT INTO agent_runs (workspace_id, agent_id, job_id, action_type, correlation_id, correction_depth, source) VALUES (gen_random_uuid(), 'inbox', 'j-test', 'test', gen_random_uuid(), 6, 'agent')$$,
  '23514'
);

-- Test 2: source enum validated
SELECT throws_ok(
  $$INSERT INTO agent_runs (workspace_id, agent_id, job_id, action_type, correlation_id, source) VALUES (gen_random_uuid(), 'inbox', 'j-test', 'test', gen_random_uuid(), 'invalid_source')$$,
  '22P02'
);

-- Test 3: agent_run_source enum has correct values
SELECT is(
  (SELECT count(*)::int FROM pg_enum WHERE enumtypid = 'agent_run_source'::regtype),
  2,
  'agent_run_source enum has 2 values'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'agent_run_source'::regtype AND enumlabel = 'agent'),
  'agent_run_source contains agent'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_enum WHERE enumtypid = 'agent_run_source'::regtype AND enumlabel = 'human_correction'),
  'agent_run_source contains human_correction'
);

SELECT finish();
ROLLBACK;
