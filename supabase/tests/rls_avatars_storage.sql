-- pgTAP RLS tests: storage.objects (avatars bucket)
-- Purpose: Verify avatar storage self-scoped access policies
-- Related: Story 1.5 AC#4, #5, #6

BEGIN;

SELECT plan(8);

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'user_a@test.com', '{}', '{}'),
  ('22222222-2222-2222-2222-222222222222', 'user_b@test.com', '{}', '{}');

-- User A can upload to own folder
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', false);
SELECT lives_ok(
  $$INSERT INTO storage.objects (bucket_id, name, content_type) VALUES ('avatars', '11111111-1111-1111-1111-111111111111/test.jpg', 'image/jpeg')$$,
  'User A can upload to own avatar folder'
);
SELECT reset_role();

-- User A can read own avatar
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', false);
SELECT results_eq(
  $$SELECT count(*) FROM storage.objects WHERE bucket_id = 'avatars' AND name LIKE '11111111-1111-1111-1111-111111111111/%'$$,
  ARRAY[ARRAY['1'::bigint]],
  'User A sees own avatar'
);
SELECT reset_role();

-- User B cannot read User A avatars
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222"}', false);
SELECT results_eq(
  $$SELECT count(*) FROM storage.objects WHERE bucket_id = 'avatars' AND name LIKE '11111111-1111-1111-1111-111111111111/%'$$,
  ARRAY[ARRAY['0'::bigint]],
  'User B cannot see User A avatars'
);
SELECT reset_role();

-- User B cannot upload to User A folder
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222"}', false);
SELECT throws_ok(
  $$INSERT INTO storage.objects (bucket_id, name, content_type) VALUES ('avatars', '11111111-1111-1111-1111-111111111111/hack.jpg', 'image/jpeg')$$,
  '42501',
  'User B cannot upload to User A folder'
);
SELECT reset_role();

-- User A can delete own avatar
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', false);
SELECT lives_ok(
  $$DELETE FROM storage.objects WHERE bucket_id = 'avatars' AND name = '11111111-1111-1111-1111-111111111111/test.jpg'$$,
  'User A can delete own avatar'
);
SELECT reset_role();

-- User B cannot delete User A avatar (re-upload first)
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', false);
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', false);
INSERT INTO storage.objects (bucket_id, name, content_type) VALUES ('avatars', '11111111-1111-1111-1111-111111111111/test2.jpg', 'image/jpeg');
SELECT reset_role();

SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222"}', false);
SELECT throws_ok(
  $$DELETE FROM storage.objects WHERE bucket_id = 'avatars' AND name = '11111111-1111-1111-1111-111111111111/test2.jpg'$$,
  '42501',
  'User B cannot delete User A avatar'
);
SELECT reset_role();

-- Unauthenticated sees nothing
SELECT set_config('request.jwt.claims', '{}', false);
SELECT results_eq(
  $$SELECT count(*) FROM storage.objects WHERE bucket_id = 'avatars'$$,
  ARRAY[ARRAY['0'::bigint]],
  'Unauthenticated sees no avatars'
);
SELECT reset_role();

-- Cleanup
DELETE FROM storage.objects WHERE bucket_id = 'avatars';
DELETE FROM auth.users WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

SELECT * FROM finish();
ROLLBACK;
