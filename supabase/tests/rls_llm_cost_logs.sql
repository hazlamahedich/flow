-- pgTAP RLS tests: llm_cost_logs table
-- Purpose: Verify llm_cost_logs RLS policies — member SELECT own tenant, service_role-only INSERT, immutable rows
-- Related: Story 2.2 AC#7,#8 — P0 gate, all tests must pass

BEGIN;

SELECT plan(9);

-- Setup
INSERT INTO workspaces (id, name, slug) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'WS Cost A', 'pgtap-cost-alpha'),
  ('c0000000-0000-0000-0000-000000000002', 'WS Cost B', 'pgtap-cost-beta')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'owner-cost@pgtap.test'),
  ('d0000000-0000-0000-0000-000000000002', 'member-cost@pgtap.test'),
  ('d0000000-0000-0000-0000-000000000003', 'owner-b-cost@pgtap.test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'owner'),
  ('c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'member'),
  ('c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003', 'owner')
ON CONFLICT DO NOTHING;

-- Seed cost logs as service_role
INSERT INTO llm_cost_logs (workspace_id, agent_id, provider, model, input_tokens, output_tokens, estimated_cost_cents, actual_cost_cents)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'inbox', 'groq', 'llama-3.3-70b', 100, 50, 1, 1),
  ('c0000000-0000-0000-0000-000000000001', 'calendar', 'anthropic', 'claude-haiku-4', 200, 100, 5, 5),
  ('c0000000-0000-0000-0000-000000000002', 'inbox', 'groq', 'llama-3.3-70b', 100, 50, 1, 1);

-- TC-01: Owner can SELECT own workspace cost logs
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "d0000000-0000-0000-0000-000000000001", "workspace_id": "c0000000-0000-0000-0000-000000000001", "role": "owner"}', false);
SELECT results_eq(
  $$ SELECT count(*) FROM llm_cost_logs WHERE workspace_id = 'c0000000-0000-0000-0000-000000000001' $$,
  ARRAY[2::bigint],
  'TC-01: owner can see own workspace cost logs'
);
RESET ROLE;

-- TC-02: Member can SELECT own workspace cost logs
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "d0000000-0000-0000-0000-000000000002", "workspace_id": "c0000000-0000-0000-0000-000000000001", "role": "member"}', false);
SELECT results_eq(
  $$ SELECT count(*) FROM llm_cost_logs WHERE workspace_id = 'c0000000-0000-0000-0000-000000000001' $$,
  ARRAY[2::bigint],
  'TC-02: member can see own workspace cost logs'
);
RESET ROLE;

-- TC-03: Workspace isolation — cannot SELECT other workspace
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "d0000000-0000-0000-0000-000000000003", "workspace_id": "c0000000-0000-0000-0000-000000000002", "role": "owner"}', false);
SELECT results_eq(
  $$ SELECT count(*) FROM llm_cost_logs WHERE workspace_id = 'c0000000-0000-0000-0000-000000000001' $$,
  ARRAY[0::bigint],
  'TC-03: cannot see other workspace cost logs'
);
RESET ROLE;

-- TC-04: Owner cannot INSERT (service_role only)
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "d0000000-0000-0000-0000-000000000001", "workspace_id": "c0000000-0000-0000-0000-000000000001", "role": "owner"}', false);
SELECT throws_ok(
  $$ INSERT INTO llm_cost_logs (workspace_id, agent_id, provider, model, input_tokens, output_tokens) VALUES ('c0000000-0000-0000-0000-000000000001', 'inbox', 'groq', 'test', 1, 1) $$,
  '42501',
  NULL,
  'TC-04: owner cannot insert cost logs'
);
RESET ROLE;

-- TC-05: No UPDATE by any authenticated user
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "d0000000-0000-0000-0000-000000000001", "workspace_id": "c0000000-0000-0000-0000-000000000001", "role": "owner"}', false);
SELECT throws_ok(
  $$ UPDATE llm_cost_logs SET actual_cost_cents = 999 $$,
  '42501',
  NULL,
  'TC-05: owner cannot update cost logs (immutable)'
);
RESET ROLE;

-- TC-06: No DELETE by any authenticated user
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "d0000000-0000-0000-0000-000000000001", "workspace_id": "c0000000-0000-0000-0000-000000000001", "role": "owner"}', false);
SELECT throws_ok(
  $$ DELETE FROM llm_cost_logs WHERE workspace_id = 'c0000000-0000-0000-0000-000000000001' $$,
  '42501',
  NULL,
  'TC-06: owner cannot delete cost logs (immutable)'
);
RESET ROLE;

-- TC-07: ::text cast correctness — wrong format returns nothing
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "d0000000-0000-0000-0000-000000000001", "workspace_id": "not-a-uuid", "role": "owner"}', false);
SELECT results_eq(
  $$ SELECT count(*) FROM llm_cost_logs $$,
  ARRAY[0::bigint],
  'TC-07: wrong workspace_id format returns zero rows'
);
RESET ROLE;

-- TC-08: service_role can INSERT
SET ROLE service_role;
SELECT lives_ok(
  $$ INSERT INTO llm_cost_logs (workspace_id, agent_id, provider, model, input_tokens, output_tokens, estimated_cost_cents) VALUES ('c0000000-0000-0000-0000-000000000001', 'inbox', 'gemini', 'gemini-2.0-flash', 50, 25, 1) $$,
  'TC-08: service_role can insert cost logs'
);
RESET ROLE;

-- TC-09: service_role can SELECT all
SET ROLE service_role;
SELECT results_eq(
  $$ SELECT count(*) FROM llm_cost_logs $$,
  ARRAY[4::bigint],
  'TC-09: service_role sees all cost logs across workspaces'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
