-- pgTAP RLS tests: app_config table
-- Purpose: Verify authenticated read, service_role write only
-- Related: Story 1.2 AC#9 — P0 gate, all tests must pass

BEGIN;

CREATE OR REPLACE FUNCTION reset_role() RETURNS void AS $$
BEGIN
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '', false);
END;
$$ LANGUAGE plpgsql;

SELECT plan(6);

-- Authenticated user can read app_config (4 rows from seed)
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', false);
SELECT is(
  (SELECT count(*) FROM app_config),
  4::bigint,
  'Authenticated user sees all 4 config rows'
);
SELECT reset_role();

-- Authenticated user cannot INSERT (throws 42501)
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', false);
SELECT throws_ok(
  $$INSERT INTO app_config (key, value) VALUES ('test_key', '{"test": true}'::jsonb)$$,
  42501
);
SELECT reset_role();

-- Authenticated user cannot UPDATE (no UPDATE policy, silently 0 rows, data unchanged)
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', false);
SELECT lives_ok(
  $$UPDATE app_config SET value = '{"hacked": true}'::jsonb WHERE key = 'tier_limits'$$,
  'Authenticated UPDATE returns 0 rows (no write policy)'
);
SELECT reset_role();

-- Verify data unchanged after UPDATE attempt
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', false);
SELECT is(
  (SELECT count(*) FROM app_config),
  4::bigint,
  'app_config data unchanged after UPDATE attempt'
);
SELECT reset_role();

-- Unauthenticated user sees nothing
SET ROLE anon;
SELECT set_config('request.jwt.claims', '{}', false);
SELECT is(
  (SELECT count(*) FROM app_config),
  0::bigint,
  'Unauthenticated user sees 0 config rows'
);
SELECT reset_role();

-- Authenticated user cannot DELETE (no DELETE policy, silently 0 rows, data unchanged)
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', false);
SELECT lives_ok(
  'DELETE FROM app_config WHERE key = ''tier_limits''',
  'Authenticated DELETE returns 0 rows (no write policy)'
);
SELECT reset_role();

SELECT * FROM finish();
ROLLBACK;
