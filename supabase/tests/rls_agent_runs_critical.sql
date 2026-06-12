-- TC-06 through TC-09: RLS tests for agent_signals and agent_runs
-- Related: Story 2.1a - Agent Orchestrator Interface & Schema Foundation

BEGIN;

SELECT plan(6);

SET ROLE postgres;

-- Create two workspaces for isolation testing
INSERT INTO workspaces (id, name, slug)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'ws-alpha', 'ws-alpha'),
  ('22222222-2222-2222-2222-222222222222', 'ws-beta', 'ws-beta');

-- Create test users with workspace claims
INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'alpha@test.flow.local', '{}', now(), now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'beta@test.flow.local', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'alpha@test.flow.local'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'beta@test.flow.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner'),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'owner');

-- Insert test data as superuser (bypasses RLS)
INSERT INTO agent_signals (id, correlation_id, agent_id, signal_type, workspace_id)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'inbox', 'inbox.categorized.email', '11111111-1111-1111-1111-111111111111'),
  ('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'inbox', 'inbox.categorized.email', '22222222-2222-2222-2222-222222222222');

INSERT INTO agent_runs (id, workspace_id, agent_id, job_id, action_type, correlation_id)
VALUES
  ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'inbox', 'job-alpha-1', 'categorize', 'c0000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'inbox', 'job-beta-1', 'categorize', 'c0000000-0000-0000-0000-000000000002');

-- TC-06: workspace isolation on read (agent_signals) — alpha user sees only own
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "workspace_id": "11111111-1111-1111-1111-111111111111"}';
SELECT results_eq(
  $$SELECT count(*) FROM agent_signals$$,
  ARRAY[1::bigint],
  'TC-06: alpha workspace can only see own signals'
);

-- TC-07: workspace isolation on read (agent_runs) — alpha user sees only own
SELECT results_eq(
  $$SELECT count(*) FROM agent_runs$$,
  ARRAY[1::bigint],
  'TC-07: alpha workspace can only see own runs'
);

RESET ROLE;

-- TC-08: anon role sees no rows (no policy for anon)
SET ROLE anon;
SELECT is(
  (SELECT count(*)::int FROM agent_signals),
  0,
  'TC-08: anon sees no agent_signals'
);

SELECT is(
  (SELECT count(*)::int FROM agent_runs),
  0,
  'TC-08: anon sees no agent_runs'
);

RESET ROLE;

-- TC-09: ::text cast correctness - verify index can be used
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "workspace_id": "11111111-1111-1111-1111-111111111111"}';
SELECT results_eq(
  $$SELECT count(*) FROM agent_signals WHERE workspace_id::text = '11111111-1111-1111-1111-111111111111'$$,
  ARRAY[1::bigint],
  'TC-09: ::text cast on workspace_id returns correct results'
);

SELECT results_eq(
  $$SELECT count(*) FROM agent_runs WHERE workspace_id::text = '11111111-1111-1111-1111-111111111111'$$,
  ARRAY[1::bigint],
  'TC-09: ::text cast on workspace_id returns correct results for runs'
);

SELECT * FROM finish();
ROLLBACK;
