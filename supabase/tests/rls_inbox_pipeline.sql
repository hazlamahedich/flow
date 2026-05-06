-- Test: RLS policies for Story 4.4a (Inbox Pipeline)
-- Related: AC8 (cross-client isolation)

BEGIN;

SELECT plan(18);

-- 1. Setup test data
INSERT INTO workspaces (id, name, slug) 
VALUES ('11111111-1111-1111-1111-111111111111', 'Workspace A', 'workspace-a'),
       ('22222222-2222-2222-2222-222222222222', 'Workspace B', 'workspace-b');

INSERT INTO clients (id, workspace_id, name, email)
VALUES ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'Client A', 'clientA@test.com');

INSERT INTO client_inboxes (id, workspace_id, client_id, email_address, access_type)
VALUES ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 'clientA@test.com', 'direct');

INSERT INTO emails (id, workspace_id, client_inbox_id, client_id, from_address, received_at, gmail_message_id, gmail_thread_id)
VALUES ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444', 'sender@test.com', now(), 'msg1', 'thread1');

-- 2. Test extracted_actions RLS
SET ROLE authenticated;
SET request.jwt.claims = '{"workspace_id": "11111111-1111-1111-1111-111111111111"}';

-- Insert should succeed for own workspace
SELECT lives_ok(
  $$ INSERT INTO extracted_actions (email_id, workspace_id, client_inbox_id, action_type, description, confidence) 
     VALUES ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'task', 'Test action', 0.9) $$,
  'Authenticated user can insert extracted_actions for their workspace'
);

-- Select should return data for own workspace
SELECT results_eq(
  $$ SELECT count(*)::int FROM extracted_actions WHERE workspace_id = '11111111-1111-1111-1111-111111111111' $$,
  ARRAY[1],
  'Authenticated user can select extracted_actions for their workspace'
);

-- Select should NOT return data for other workspace
SET request.jwt.claims = '{"workspace_id": "22222222-2222-2222-2222-222222222222"}';
SELECT results_eq(
  $$ SELECT count(*)::int FROM extracted_actions WHERE workspace_id = '11111111-1111-1111-1111-111111111111' $$,
  ARRAY[0],
  'Authenticated user cannot select extracted_actions for other workspace'
);

-- 3. Test draft_responses RLS
SET request.jwt.claims = '{"workspace_id": "11111111-1111-1111-1111-111111111111"}';
SELECT lives_ok(
  $$ INSERT INTO draft_responses (email_id, workspace_id, client_inbox_id, draft_content, trust_at_generation) 
     VALUES ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'Draft content', 2) $$,
  'Authenticated user can insert draft_responses for their workspace'
);

SELECT results_eq(
  $$ SELECT count(*)::int FROM draft_responses WHERE workspace_id = '11111111-1111-1111-1111-111111111111' $$,
  ARRAY[1],
  'Authenticated user can select draft_responses for their workspace'
);

-- 4. Test workspace_voice_profiles RLS
SELECT lives_ok(
  $$ INSERT INTO workspace_voice_profiles (workspace_id, default_tone) 
     VALUES ('11111111-1111-1111-1111-111111111111', 'professional') $$,
  'Authenticated user can insert workspace_voice_profiles for their workspace'
);

-- 5. Test client_tone_overrides RLS
SELECT lives_ok(
  $$ INSERT INTO client_tone_overrides (workspace_id, client_id, tone) 
     VALUES ('11111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 'casual') $$,
  'Authenticated user can insert client_tone_overrides for their workspace'
);

-- 6. Test inbox_trust_metrics RLS (Select only)
SET ROLE service_role;
INSERT INTO inbox_trust_metrics (workspace_id, client_inbox_id, metric_type, metric_value, sample_count)
VALUES ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'recategorization_rate', 0.05, 100);

SET ROLE authenticated;
SET request.jwt.claims = '{"workspace_id": "11111111-1111-1111-1111-111111111111"}';
SELECT results_eq(
  $$ SELECT count(*)::int FROM inbox_trust_metrics WHERE workspace_id = '11111111-1111-1111-1111-111111111111' $$,
  ARRAY[1],
  'Authenticated user can select inbox_trust_metrics for their workspace'
);

-- 7. Test email_processing_state RLS
SELECT lives_ok(
  $$ INSERT INTO email_processing_state (email_id, workspace_id, state) 
     VALUES ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'extraction_complete') $$,
  'Authenticated user can insert email_processing_state for their workspace'
);

-- 8. service_role can access everything
SET ROLE service_role;
SELECT lives_ok(
  $$ SELECT * FROM extracted_actions $$,
  'service_role can select extracted_actions'
);

-- Additional assertions for isolation
SET ROLE authenticated;
SET request.jwt.claims = '{"workspace_id": "22222222-2222-2222-2222-222222222222"}';

SELECT is_empty(
  $$ SELECT * FROM extracted_actions WHERE workspace_id = '11111111-1111-1111-1111-111111111111' $$,
  'Workspace B user cannot see Workspace A extracted_actions'
);

SELECT is_empty(
  $$ SELECT * FROM draft_responses WHERE workspace_id = '11111111-1111-1111-1111-111111111111' $$,
  'Workspace B user cannot see Workspace A draft_responses'
);

SELECT is_empty(
  $$ SELECT * FROM workspace_voice_profiles WHERE workspace_id = '11111111-1111-1111-1111-111111111111' $$,
  'Workspace B user cannot see Workspace A voice profiles'
);

SELECT is_empty(
  $$ SELECT * FROM client_tone_overrides WHERE workspace_id = '11111111-1111-1111-1111-111111111111' $$,
  'Workspace B user cannot see Workspace A tone overrides'
);

SELECT is_empty(
  $$ SELECT * FROM inbox_trust_metrics WHERE workspace_id = '11111111-1111-1111-1111-111111111111' $$,
  'Workspace B user cannot see Workspace A trust metrics'
);

SELECT is_empty(
  $$ SELECT * FROM email_processing_state WHERE workspace_id = '11111111-1111-1111-1111-111111111111' $$,
  'Workspace B user cannot see Workspace A processing state'
);

SELECT is_empty(
  $$ SELECT * FROM recategorization_log WHERE workspace_id = '11111111-1111-1111-1111-111111111111' $$,
  'Workspace B user cannot see Workspace A recategorization logs'
);

-- Finish tests
SELECT * FROM finish();
ROLLBACK;
