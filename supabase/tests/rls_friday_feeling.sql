-- pgTAP RLS tests for friday_feeling_summaries and wednesday_affirmations tables
-- Story 8.4: Friday Feeling Ritual

BEGIN;

SELECT plan(14);

-- ───────────────────────────────────────────────────────────────
-- Setup: Create test workspace, users, and roles
-- ───────────────────────────────────────────────────────────────

DELETE FROM friday_feeling_summaries WHERE workspace_id IN (
  SELECT id FROM workspaces WHERE name LIKE 'rls_test_ff_%'
);

DELETE FROM wednesday_affirmations WHERE workspace_id IN (
  SELECT id FROM workspaces WHERE name LIKE 'rls_test_ff_%'
);

INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at)
VALUES
  ('44444444-4444-4444-4444-444444444401', 'ff_owner@test.com', '{"full_name":"Owner"}', now(), now()),
  ('44444444-4444-4444-4444-444444444402', 'ff_member@test.com', '{"full_name":"Member"}', now(), now()),
  ('44444444-4444-4444-4444-444444444403', 'ff_other@test.com', '{"full_name":"Other"}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspaces (id, name, slug, owner_id, is_agency, created_at)
VALUES
  ('55555555-5555-5555-5555-555555555501', 'rls_test_ff_ws_a', 'rls-test-ff-ws-a', '44444444-4444-4444-4444-444444444401', true, now()),
  ('55555555-5555-5555-5555-555555555502', 'rls_test_ff_ws_b', 'rls-test-ff-ws-b', '44444444-4444-4444-4444-444444444403', false, now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role, created_at)
VALUES
  ('55555555-5555-5555-5555-555555555501', '44444444-4444-4444-4444-444444444401', 'owner', now()),
  ('55555555-5555-5555-5555-555555555501', '44444444-4444-4444-4444-444444444402', 'member', now()),
  ('55555555-5555-5555-5555-555555555502', '44444444-4444-4444-4444-444444444403', 'owner', now())
ON CONFLICT DO NOTHING;

-- ───────────────────────────────────────────────────────────────
-- friday_feeling_summaries
-- ───────────────────────────────────────────────────────────────

-- Test 1: Table exists
SELECT has_table('friday_feeling_summaries', 'Table friday_feeling_summaries exists');

-- Test 2: RLS enabled
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'friday_feeling_summaries'),
  true,
  'RLS is enabled on friday_feeling_summaries'
);

-- Test 3: Owner can SELECT summaries
SET request.jwt.claims = '{"workspace_id": "55555555-5555-5555-5555-555555555501", "role": "owner", "sub": "44444444-4444-4444-4444-444444444401"}';

SELECT lives_ok(
  $$SELECT * FROM friday_feeling_summaries WHERE workspace_id = '55555555-5555-5555-5555-555555555501'$$,
  'Owner can SELECT friday_feeling_summaries in their workspace'
);

-- Test 4: Member can SELECT summaries
SET request.jwt.claims = '{"workspace_id": "55555555-5555-5555-5555-555555555501", "role": "member", "sub": "44444444-4444-4444-4444-444444444402"}';

SELECT lives_ok(
  $$SELECT * FROM friday_feeling_summaries WHERE workspace_id = '55555555-5555-5555-5555-555555555501'$$,
  'Member can SELECT friday_feeling_summaries in their workspace'
);

-- Test 5: Cross-tenant isolation
SET LOCAL ROLE service_role;
INSERT INTO friday_feeling_summaries (workspace_id, user_id, week_start, week_end, headline, tasks_handled, time_saved_minutes, trust_milestones)
VALUES ('55555555-5555-5555-5555-555555555502', '44444444-4444-4444-4444-444444444403', '2026-05-19', '2026-05-25', 'Test', 5, 25, '[]')
ON CONFLICT DO NOTHING;
RESET ROLE;

SET request.jwt.claims = '{"workspace_id": "55555555-5555-5555-5555-555555555501", "role": "member", "sub": "44444444-4444-4444-4444-444444444402"}';

SELECT is_empty(
  $$SELECT * FROM friday_feeling_summaries WHERE workspace_id = '55555555-5555-5555-5555-555555555502'$$,
  'Workspace A member sees zero rows from Workspace B friday_feeling_summaries'
);

-- Test 6: Regular user cannot INSERT (service_role only)
SET request.jwt.claims = '{"workspace_id": "55555555-5555-5555-5555-555555555501", "role": "owner", "sub": "44444444-4444-4444-4444-444444444401"}';

SELECT throws_ok(
  $$INSERT INTO friday_feeling_summaries (workspace_id, user_id, week_start, week_end, headline, tasks_handled, time_saved_minutes, trust_milestones)
    VALUES ('55555555-5555-5555-5555-555555555501', '44444444-4444-4444-4444-444444444401', '2026-06-01', '2026-06-07', 'Test', 1, 5, '[]')$$,
  '42501',
  NULL,
  'Owner cannot INSERT into friday_feeling_summaries (service_role only)'
);

-- ───────────────────────────────────────────────────────────────
-- wednesday_affirmations
-- ───────────────────────────────────────────────────────────────

-- Test 7: Table exists
SELECT has_table('wednesday_affirmations', 'Table wednesday_affirmations exists');

-- Test 8: RLS enabled
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'wednesday_affirmations'),
  true,
  'RLS is enabled on wednesday_affirmations'
);

-- Test 9: Owner can SELECT affirmations
SET request.jwt.claims = '{"workspace_id": "55555555-5555-5555-5555-555555555501", "role": "owner", "sub": "44444444-4444-4444-4444-444444444401"}';

SELECT lives_ok(
  $$SELECT * FROM wednesday_affirmations WHERE workspace_id = '55555555-5555-5555-5555-555555555501'$$,
  'Owner can SELECT wednesday_affirmations in their workspace'
);

-- Test 10: Member cannot SELECT affirmations (owner-only per AC5)
SET request.jwt.claims = '{"workspace_id": "55555555-5555-5555-5555-555555555501", "role": "member", "sub": "44444444-4444-4444-4444-444444444402"}';

SELECT is_empty(
  $$SELECT * FROM wednesday_affirmations WHERE workspace_id = '55555555-5555-5555-5555-555555555501'$$,
  'Member sees zero rows from wednesday_affirmations (owner-only)'
);

-- Test 11: Cross-tenant isolation
SET LOCAL ROLE service_role;
INSERT INTO wednesday_affirmations (workspace_id, team_member_id, story, milestone)
VALUES ('55555555-5555-5555-5555-555555555502', '44444444-4444-4444-4444-444444444403', 'Test affirmation', '{"agent_type":"calendar","trust_level":"auto"}')
ON CONFLICT DO NOTHING;
RESET ROLE;

SET request.jwt.claims = '{"workspace_id": "55555555-5555-5555-5555-555555555501", "role": "owner", "sub": "44444444-4444-4444-4444-444444444401"}';

SELECT is_empty(
  $$SELECT * FROM wednesday_affirmations WHERE workspace_id = '55555555-5555-5555-5555-555555555502'$$,
  'Workspace A owner sees zero rows from Workspace B wednesday_affirmations'
);

-- Test 12: Regular user cannot INSERT into wednesday_affirmations
SET request.jwt.claims = '{"workspace_id": "55555555-5555-5555-5555-555555555501", "role": "owner", "sub": "44444444-4444-4444-4444-444444444401"}';

SELECT throws_ok(
  $$INSERT INTO wednesday_affirmations (workspace_id, team_member_id, story, milestone)
    VALUES ('55555555-5555-5555-5555-555555555501', '44444444-4444-4444-4444-444444444402', 'Test', '{}')$$,
  '42501',
  NULL,
  'Owner cannot INSERT into wednesday_affirmations (service_role only)'
);

-- Test 13: Owner can UPDATE dismissed_at on friday_feeling_summaries
SET request.jwt.claims = '{"workspace_id": "55555555-5555-5555-5555-555555555501", "role": "owner", "sub": "44444444-4444-4444-4444-444444444401"}';

SET LOCAL ROLE service_role;
INSERT INTO friday_feeling_summaries (workspace_id, user_id, week_start, week_end, headline, tasks_handled, time_saved_minutes, trust_milestones)
VALUES ('55555555-5555-5555-5555-555555555501', '44444444-4444-4444-4444-444444444401', '2026-06-08', '2026-06-14', 'Test dismiss', 2, 10, '[]')
ON CONFLICT DO NOTHING;
RESET ROLE;

SELECT lives_ok(
  $$UPDATE friday_feeling_summaries SET dismissed_at = now() WHERE workspace_id = '55555555-5555-5555-5555-555555555501' AND week_start = '2026-06-08'$$,
  'Owner can UPDATE dismissed_at on friday_feeling_summaries'
);

-- Test 14: Owner can UPDATE dismissed_at on wednesday_affirmations
SET request.jwt.claims = '{"workspace_id": "55555555-5555-5555-5555-555555555501", "role": "owner", "sub": "44444444-4444-4444-4444-444444444401"}';

SET LOCAL ROLE service_role;
INSERT INTO wednesday_affirmations (workspace_id, team_member_id, story, milestone)
VALUES ('55555555-5555-5555-5555-555555555501', '44444444-4444-4444-4444-444444444402', 'Test dismiss affirm', '{"agent_type":"email","trust_level":"confirm"}')
ON CONFLICT DO NOTHING;
RESET ROLE;

SELECT lives_ok(
  $$UPDATE wednesday_affirmations SET dismissed_at = now() WHERE workspace_id = '55555555-5555-5555-5555-555555555501' AND story = 'Test dismiss affirm'$$,
  'Owner can UPDATE dismissed_at on wednesday_affirmations'
);

-- ───────────────────────────────────────────────────────────────
-- Cleanup
-- ───────────────────────────────────────────────────────────────
RESET request.jwt.claims;

SELECT * FROM finish();
ROLLBACK;
