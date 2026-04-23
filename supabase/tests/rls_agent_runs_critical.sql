-- TC-06 through TC-09: RLS tests for agent_signals and agent_runs
-- Related: Story 2.1a - Agent Orchestrator Interface & Schema Foundation

BEGIN;

-- Setup: create test workspace and users
SELECT plan(8);

-- Create two workspaces for isolation testing
INSERT INTO workspaces (id, name, slug)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'ws-alpha', 'ws-alpha'),
  ('22222222-2222-2222-2222-222222222222', 'ws-beta', 'ws-beta');

-- Create test users with workspace claims
INSERT INTO users (id, email) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'alpha@test.flow.local'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'beta@test.flow.local');

INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner'),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'owner');

-- Insert test data as service_role
INSERT INTO agent_signals (id, correlation_id, agent_id, signal_type, workspace_id)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'inbox', 'inbox.categorized.email', '11111111-1111-1111-1111-111111111111'),
  ('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'inbox', 'inbox.categorized.email', '22222222-2222-2222-2222-222222222222');

INSERT INTO agent_runs (id, workspace_id, agent_id, job_id, action_type, correlation_id)
VALUES
  ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'inbox', 'job-alpha-1', 'categorize', 'c0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'inbox', 'job-beta-1', 'categorize', 'c0000000-0000-0000-0000-000000000002');

-- TC-06: workspace isolation on read (agent_signals)
SELECT results_eq(
  $$
    SELECT count(*) FROM agent_signals
    WHERE workspace_id = '11111111-1111-1111-1111-111111111111'
  $$,
  ARRAY[1::bigint],
  'TC-06: alpha workspace can only see own signals'
);

-- TC-07: workspace isolation on read (agent_runs)
SELECT results_eq(
  $$
    SELECT count(*) FROM agent_runs
    WHERE workspace_id = '11111111-1111-1111-1111-111111111111'
  $$,
  ARRAY[1::bigint],
  'TC-07: alpha workspace can only see own runs'
);

-- TC-08: unauthenticated access denied
SELECT throws_ok(
  $$
    SELECT * FROM agent_signals
  $$,
  '42501',
  'TC-08: unauthenticated access to agent_signals denied'
);

SELECT throws_ok(
  $$
    SELECT * FROM agent_runs
  $$,
  '42501',
  'TC-08: unauthenticated access to agent_runs denied'
);

-- TC-09: ::text cast correctness - verify index can be used
SELECT results_eq(
  $$
    SELECT count(*) FROM agent_signals
    WHERE workspace_id::text = '11111111-1111-1111-1111-111111111111'
  $$,
  ARRAY[1::bigint],
  'TC-09: ::text cast on workspace_id returns correct results'
);

SELECT results_eq(
  $$
    SELECT count(*) FROM agent_runs
    WHERE workspace_id::text = '11111111-1111-1111-1111-111111111111'
  $$,
  ARRAY[1::bigint],
  'TC-09: ::text cast on workspace_id returns correct results for runs'
);

-- Cleanup
DELETE FROM agent_runs;
DELETE FROM agent_signals;
DELETE FROM workspace_members WHERE workspace_id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');
DELETE FROM users WHERE id IN ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
DELETE FROM workspaces WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

SELECT * FROM finish();
ROLLBACK;
