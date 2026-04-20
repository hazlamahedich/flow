-- pgTAP RLS tests: users table
-- Purpose: Verify users can only read/update own row
-- Related: Story 1.2 AC#9 — P0 gate, all tests must pass

BEGIN;

SELECT plan(6);

-- Setup
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'user_a@test.com', '{}', '{}'),
  ('22222222-2222-2222-2222-222222222222', 'user_b@test.com', '{}', '{}');

INSERT INTO users (id, email, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'user_a@test.com', 'User A'),
  ('22222222-2222-2222-2222-222222222222', 'user_b@test.com', 'User B');

-- User can read own row
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', false);
SELECT results_eq(
  'SELECT count(*) FROM users',
  ARRAY[ARRAY['1'::bigint]],
  'User A sees exactly 1 row (own)'
);
SELECT reset_role();

-- User cannot read other users' rows
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', false);
SELECT results_eq(
  'SELECT count(*) FROM users WHERE id = ''22222222-2222-2222-2222-222222222222''',
  ARRAY[ARRAY['0'::bigint]],
  'User A cannot read User B row'
);
SELECT reset_role();

-- User can update own row
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', false);
SELECT lives_ok(
  'UPDATE users SET name = ''Updated A'' WHERE id = ''11111111-1111-1111-1111-111111111111''',
  'User can update own profile'
);
SELECT reset_role();

-- User cannot update other users' rows
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', false);
SELECT throws_ok(
  'UPDATE users SET name = ''Hacked'' WHERE id = ''22222222-2222-2222-2222-222222222222''',
  '42501',
  'User cannot update other user row'
);
SELECT reset_role();

-- Unauthenticated user sees nothing
SELECT set_config('request.jwt.claims', '{}', false);
SELECT results_eq(
  'SELECT count(*) FROM users',
  ARRAY[ARRAY['0'::bigint]],
  'Unauthenticated user sees 0 users'
);
SELECT reset_role();

-- Cleanup
DELETE FROM users;
DELETE FROM auth.users WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

SELECT * FROM finish();
ROLLBACK;
