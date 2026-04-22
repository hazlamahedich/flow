-- pgTAP RLS tests: email_change_requests table
-- Purpose: Verify self-only insert/select/update, cross-user denied, DELETE denied
-- Related: Story 1.5a AC#1, AC#2 — P0 gate

BEGIN;

SELECT plan(10);

-- Setup
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'user_a@test.com', '{}', '{}'),
  ('22222222-2222-2222-2222-222222222222', 'user_b@test.com', '{}', '{}');

-- Self-insert: User A can insert own row
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', false);
SELECT lives_ok(
  $$INSERT INTO email_change_requests (user_id, new_email, token) VALUES ('11111111-1111-1111-1111-111111111111', 'new_a@test.com', 'token-a-1')$$,
  'User A can insert own email change request'
);
SELECT reset_role();

-- Self-select: User A can read own rows
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', false);
SELECT results_eq(
  'SELECT count(*) FROM email_change_requests',
  ARRAY[ARRAY['1'::bigint]],
  'User A sees exactly 1 row (own)'
);
SELECT reset_role();

-- Self-update: User A can update own row
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', false);
SELECT lives_ok(
  $$UPDATE email_change_requests SET status = 'cancelled' WHERE user_id = '11111111-1111-1111-1111-111111111111' AND token = 'token-a-1'$$,
  'User A can update own email change request'
);
SELECT reset_role();

-- Reset for remaining tests
UPDATE email_change_requests SET status = 'pending' WHERE token = 'token-a-1';

-- Cross-user insert: User B cannot insert as User A
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222"}', false);
SELECT throws_ok(
  $$INSERT INTO email_change_requests (user_id, new_email, token) VALUES ('11111111-1111-1111-1111-111111111111', 'hacked@test.com', 'token-hack')$$,
  '42501',
  'User B cannot insert request as User A'
);
SELECT reset_role();

-- Cross-user select: User B cannot see User A's rows
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222"}', false);
SELECT results_eq(
  'SELECT count(*) FROM email_change_requests',
  ARRAY[ARRAY['0'::bigint]],
  'User B sees 0 rows from User A'
);
SELECT reset_role();

-- Cross-user update: User B cannot update User A's rows
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222"}', false);
SELECT results_eq(
  $$SELECT count(*) FROM email_change_requests WHERE user_id = '11111111-1111-1111-1111-111111111111'$$,
  ARRAY[ARRAY['0'::bigint]],
  'User B cannot see (thus cannot update) User A rows'
);
SELECT reset_role();

-- DELETE denied for all: even the owning user cannot delete
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', false);
SELECT throws_ok(
  $$DELETE FROM email_change_requests WHERE user_id = '11111111-1111-1111-1111-111111111111'$$,
  '42501',
  'User A cannot delete own email change request (no DELETE policy)'
);
SELECT reset_role();

-- Unauthenticated user sees nothing
SELECT set_config('request.jwt.claims', '{}', false);
SELECT results_eq(
  'SELECT count(*) FROM email_change_requests',
  ARRAY[ARRAY['0'::bigint]],
  'Unauthenticated user sees 0 email change requests'
);
SELECT reset_role();

-- Unauthenticated user cannot insert
SELECT set_config('request.jwt.claims', '{}', false);
SELECT throws_ok(
  $$INSERT INTO email_change_requests (user_id, new_email, token) VALUES ('11111111-1111-1111-1111-111111111111', 'anon@test.com', 'token-anon')$$,
  '42501',
  'Unauthenticated user cannot insert email change request'
);
SELECT reset_role();

-- Cleanup
DELETE FROM email_change_requests;
DELETE FROM auth.users WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

SELECT * FROM finish();
ROLLBACK;
