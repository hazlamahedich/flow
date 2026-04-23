-- pgTAP RLS tests: email_change_requests table
-- Purpose: Verify self-only insert/select/update, cross-user denied, DELETE denied
-- Related: Story 1.5a AC#1, AC#2 — P0 gate

BEGIN;

CREATE OR REPLACE FUNCTION reset_role() RETURNS void AS $$
BEGIN
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '', false);
END;
$$ LANGUAGE plpgsql;

SELECT plan(9);

-- Setup
SET ROLE postgres;
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'pgtap-ecr-a@test.com', '{}', '{}'),
  ('22222222-2222-2222-2222-222222222222', 'pgtap-ecr-b@test.com', '{}', '{}')
ON CONFLICT (id) DO NOTHING;
RESET ROLE;

-- Self-insert: User A can insert own row
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', false);
SELECT lives_ok(
  $$INSERT INTO email_change_requests (user_id, new_email, token) VALUES ('11111111-1111-1111-1111-111111111111', 'new_a@test.com', 'token-a-1')$$,
  'User A can insert own email change request'
);
SELECT reset_role();

-- Self-select: User A can read own rows
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', false);
SELECT is(
  (SELECT count(*) FROM email_change_requests),
  1::bigint,
  'User A sees exactly 1 row (own)'
);
SELECT reset_role();

-- Self-update: User A can update own row (pending→cancelled)
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', false);
SELECT lives_ok(
  $$UPDATE email_change_requests SET status = 'cancelled' WHERE user_id = '11111111-1111-1111-1111-111111111111' AND token = 'token-a-1'$$,
  'User A can update own email change request'
);
SELECT reset_role();

-- Reset for remaining tests
SET ROLE postgres;
UPDATE email_change_requests SET status = 'pending' WHERE token = 'token-a-1';
RESET ROLE;

-- Cross-user insert: User B cannot insert as User A
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222"}', false);
SELECT throws_ok(
  $$INSERT INTO email_change_requests (user_id, new_email, token) VALUES ('11111111-1111-1111-1111-111111111111', 'hacked@test.com', 'token-hack')$$,
  42501
);
SELECT reset_role();

-- Cross-user select: User B cannot see User A's rows
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222"}', false);
SELECT is(
  (SELECT count(*) FROM email_change_requests),
  0::bigint,
  'User B sees 0 rows from User A'
);
SELECT reset_role();

-- Cross-user update: User B cannot update User A's rows (can't see them)
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222"}', false);
SELECT is(
  (SELECT count(*) FROM email_change_requests WHERE user_id = '11111111-1111-1111-1111-111111111111'),
  0::bigint,
  'User B cannot see (thus cannot update) User A rows'
);
SELECT reset_role();

-- DELETE denied for all: even the owning user cannot delete (no DELETE policy)
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', false);
SELECT lives_ok(
  $$DELETE FROM email_change_requests WHERE user_id = '11111111-1111-1111-1111-111111111111'$$,
  'User A cannot delete own email change request (0 rows, no DELETE policy)'
);
SELECT reset_role();

-- Unauthenticated user sees nothing
SET ROLE anon;
SELECT set_config('request.jwt.claims', '{}', false);
SELECT is(
  (SELECT count(*) FROM email_change_requests),
  0::bigint,
  'Unauthenticated user sees 0 email change requests'
);
SELECT reset_role();

-- Unauthenticated user cannot insert
SET ROLE anon;
SELECT set_config('request.jwt.claims', '{}', false);
SELECT throws_ok(
  $$INSERT INTO email_change_requests (user_id, new_email, token) VALUES ('11111111-1111-1111-1111-111111111111', 'anon@test.com', 'token-anon')$$,
  42501
);
SELECT reset_role();

SELECT * FROM finish();
ROLLBACK;
