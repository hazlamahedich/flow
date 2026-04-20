-- pgTAP RLS tests: app_config table
-- Purpose: Verify authenticated read, service_role write only
-- Related: Story 1.2 AC#9 — P0 gate, all tests must pass

BEGIN;

SELECT plan(5);

-- Setup: app_config already seeded in migration

-- Authenticated user can read app_config
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', false);
SELECT results_eq(
  'SELECT count(*) FROM app_config',
  ARRAY[ARRAY['4'::bigint]],
  'Authenticated user sees all 4 config rows'
);
SELECT reset_role();

-- Authenticated user cannot INSERT
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', false);
SELECT throws_ok(
  $$INSERT INTO app_config (key, value) VALUES ('test_key', '{"test": true}'::jsonb)$$,
  '42501',
  'Authenticated user cannot INSERT into app_config'
);
SELECT reset_role();

-- Authenticated user cannot UPDATE
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', false);
SELECT throws_ok(
  $$UPDATE app_config SET value = '{"hacked": true}'::jsonb WHERE key = 'tier_limits'$$,
  '42501',
  'Authenticated user cannot UPDATE app_config'
);
SELECT reset_role();

-- Authenticated user cannot DELETE
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', false);
SELECT throws_ok(
  'DELETE FROM app_config WHERE key = ''tier_limits''',
  '42501',
  'Authenticated user cannot DELETE from app_config'
);
SELECT reset_role();

-- Unauthenticated user sees nothing
SELECT set_config('request.jwt.claims', '{}', false);
SELECT results_eq(
  'SELECT count(*) FROM app_config',
  ARRAY[ARRAY['0'::bigint]],
  'Unauthenticated user sees 0 config rows'
);
SELECT reset_role();

SELECT * FROM finish();
ROLLBACK;
