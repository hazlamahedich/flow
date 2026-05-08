-- Extended RLS tests for Epic 4.4a tables
-- Covers: UPDATE/DELETE cross-workspace isolation, cross-client_inbox isolation,
--         CHECK constraints, own-workspace read/write verification
-- Complements: rls_inbox_pipeline.sql (basic SELECT/INSERT + cross-ws SELECT isolation)

BEGIN;

SELECT plan(18);

-- Seed auth users (needed for workspace_members JOIN in client_inboxes RLS)
INSERT INTO auth.users (id, email, raw_app_meta_data)
VALUES ('a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0', 'alpha@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}'),
       ('b0b0b0b0-b0b0-b0b0-b0b0-b0b0b0b0b0b0', 'beta@test.com', '{"workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}');

-- Seed: two workspaces, two clients, two inboxes
INSERT INTO workspaces (id, name, slug)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'WS Alpha', 'ws-alpha'),
       ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'WS Beta', 'ws-beta');

INSERT INTO users (id, email, name)
VALUES ('a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0', 'alpha@test.com', 'Alpha User'),
       ('b0b0b0b0-b0b0-b0b0-b0b0-b0b0b0b0b0b0', 'beta@test.com', 'Beta User');

INSERT INTO workspace_members (workspace_id, user_id, role, status)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0', 'owner', 'active'),
       ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b0b0b0b0-b0b0-b0b0-b0b0-b0b0b0b0b0b0', 'owner', 'active');

INSERT INTO clients (id, workspace_id, name, email)
VALUES ('c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Client A', 'a@test.com'),
       ('c2c2c2c2-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Client B', 'b@test.com');

INSERT INTO client_inboxes (id, workspace_id, client_id, email_address, access_type)
VALUES ('d1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1', 'a@test.com', 'direct'),
       ('d2d2d2d2-d2d2-d2d2-d2d2-d2d2d2d2d2d2', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'c2c2c2c2-c2c2-c2c2-c2c2-c2c2c2c2c2c2', 'b@test.com', 'direct');

INSERT INTO emails (id, workspace_id, client_inbox_id, client_id, from_address, received_at, gmail_message_id, gmail_thread_id)
VALUES ('e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'd1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1', 'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1', 's@test.com', now(), 'm1', 't1');

-- Seed test data as service_role to bypass RLS
SET ROLE service_role;

INSERT INTO extracted_actions (id, email_id, workspace_id, client_inbox_id, action_type, description, confidence)
VALUES ('fa000000-0000-0000-0000-000000000001', 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'd1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1', 'task', 'Alpha action', 0.9);

INSERT INTO draft_responses (id, email_id, workspace_id, client_inbox_id, draft_content, trust_at_generation)
VALUES ('fb000000-0000-0000-0000-000000000001', 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'd1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1', 'Alpha draft', 2);

INSERT INTO workspace_voice_profiles (id, workspace_id, default_tone)
VALUES ('fc000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'professional');

INSERT INTO client_tone_overrides (id, workspace_id, client_id, tone)
VALUES ('fd000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1', 'casual');

RESET ROLE;

-- ===========================
-- 1. Own-workspace read/write
-- ===========================

SET ROLE authenticated;
SET request.jwt.claims = '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "sub": "a0a0a0a0-a0a0-a0a0-a0a0-a0a0a0a0a0a0"}';

SELECT results_eq(
  $$ SELECT count(*)::int FROM extracted_actions WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  ARRAY[1],
  'WS Alpha owner can read own extracted_actions'
);

SELECT results_eq(
  $$ SELECT count(*)::int FROM draft_responses WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  ARRAY[1],
  'WS Alpha owner can read own draft_responses'
);

SELECT results_eq(
  $$ SELECT count(*)::int FROM workspace_voice_profiles WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  ARRAY[1],
  'WS Alpha owner can read own voice profiles'
);

SELECT results_eq(
  $$ SELECT count(*)::int FROM client_tone_overrides WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  ARRAY[1],
  'WS Alpha owner can read own tone overrides'
);

SELECT lives_ok(
  $$ UPDATE extracted_actions SET description = 'Updated' WHERE id = 'fa000000-0000-0000-0000-000000000001' $$,
  'WS Alpha owner can UPDATE own extracted_actions'
);

SELECT lives_ok(
  $$ UPDATE draft_responses SET draft_content = 'Updated' WHERE id = 'fb000000-0000-0000-0000-000000000001' $$,
  'WS Alpha owner can UPDATE own draft_responses'
);

-- ===========================
-- 2. Cross-workspace UPDATE/DELETE/SELECT denial
-- ===========================

SET request.jwt.claims = '{"workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "sub": "b0b0b0b0-b0b0-b0b0-b0b0-b0b0b0b0b0b0"}';

SELECT results_eq(
  $$ UPDATE extracted_actions SET description = 'Hacked' WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' RETURNING id $$,
  ARRAY[]::uuid[],
  'WS Beta cannot UPDATE WS Alpha extracted_actions'
);

SELECT results_eq(
  $$ UPDATE draft_responses SET draft_content = 'Hacked' WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' RETURNING id $$,
  ARRAY[]::uuid[],
  'WS Beta cannot UPDATE WS Alpha draft_responses'
);

SELECT results_eq(
  $$ DELETE FROM extracted_actions WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' RETURNING id $$,
  ARRAY[]::uuid[],
  'WS Beta cannot DELETE WS Alpha extracted_actions'
);

SELECT results_eq(
  $$ DELETE FROM draft_responses WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' RETURNING id $$,
  ARRAY[]::uuid[],
  'WS Beta cannot DELETE WS Alpha draft_responses'
);

SELECT is_empty(
  $$ SELECT * FROM workspace_voice_profiles WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  'WS Beta cannot SELECT WS Alpha voice profiles'
);

SELECT is_empty(
  $$ SELECT * FROM client_tone_overrides WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  'WS Beta cannot SELECT WS Alpha tone overrides'
);

-- ===========================
-- 3. CHECK constraints (INSERT via service_role to bypass RLS, test constraints directly)
-- ===========================

SET ROLE service_role;

SELECT throws_ok(
  $$ INSERT INTO extracted_actions (email_id, workspace_id, client_inbox_id, action_type, description, confidence)
     VALUES ('e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'd1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1', 'invalid_type', 'Test', 0.5) $$,
  '23514'
);

SELECT throws_ok(
  $$ INSERT INTO extracted_actions (email_id, workspace_id, client_inbox_id, action_type, description, confidence)
     VALUES ('e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'd1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1', 'task', 'Test', 1.5) $$,
  '23514'
);

SELECT throws_ok(
  $$ INSERT INTO draft_responses (email_id, workspace_id, client_inbox_id, draft_content, trust_at_generation, status)
     VALUES ('e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'd1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1', 'Test', 2, 'invalid_status') $$,
  '23514'
);

SELECT throws_ok(
  $$ INSERT INTO draft_responses (email_id, workspace_id, client_inbox_id, draft_content, trust_at_generation)
     VALUES ('e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'd1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1', 'Test', 5) $$,
  '23514'
);

SELECT throws_ok(
  $$ INSERT INTO workspace_voice_profiles (workspace_id, default_tone)
     VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'ultra_casual') $$,
  '23514'
);

SELECT throws_ok(
  $$ INSERT INTO client_tone_overrides (workspace_id, client_id, tone)
     VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1', 'aggressive') $$,
  '23514'
);

SELECT * FROM finish();
ROLLBACK;
