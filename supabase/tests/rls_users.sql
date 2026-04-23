-- pgTAP RLS tests: users table
-- Purpose: Verify users can only read/update own row
-- Related: Story 1.2 AC#9 — P0 gate, all tests must pass

BEGIN;

CREATE OR REPLACE FUNCTION reset_role() RETURNS void AS $$
BEGIN
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '', false);
END;
$$ LANGUAGE plpgsql;

SELECT plan(5);

-- Setup
SET ROLE postgres;
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'pgtap-user-a@test.com', '{}', '{}'),
  ('22222222-2222-2222-2222-222222222222', 'pgtap-user-b@test.com', '{}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'pgtap-user-a@test.com', 'User A'),
  ('22222222-2222-2222-2222-222222222222', 'pgtap-user-b@test.com', 'User B')
ON CONFLICT (id) DO NOTHING;
RESET ROLE;

-- User can read own row
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', false);
SELECT is(
  (SELECT count(*) FROM users),
  1::bigint,
  'User A sees exactly 1 row (own)'
);
SELECT reset_role();

-- User cannot read other users' rows
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', false);
SELECT is(
  (SELECT count(*) FROM users WHERE id = '22222222-2222-2222-2222-222222222222'),
  0::bigint,
  'User A cannot read User B row'
);
SELECT reset_role();

-- User can update own row
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', false);
SELECT lives_ok(
  'UPDATE users SET name = ''Updated A'' WHERE id = ''11111111-1111-1111-1111-111111111111''',
  'User can update own profile'
);
SELECT reset_role();

-- User cannot update other users' rows (RLS blocks, 0 rows updated)
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', false);
SELECT lives_ok(
  'UPDATE users SET name = ''Hacked'' WHERE id = ''22222222-2222-2222-2222-222222222222''',
  'User cannot update other user row (0 rows)'
);
SELECT reset_role();

-- Unauthenticated user sees nothing
SET ROLE anon;
SELECT set_config('request.jwt.claims', '{}', false);
SELECT is(
  (SELECT count(*) FROM users),
  0::bigint,
  'Unauthenticated user sees 0 users'
);
SELECT reset_role();

SELECT * FROM finish();
ROLLBACK;
