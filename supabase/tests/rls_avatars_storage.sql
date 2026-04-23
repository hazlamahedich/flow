-- pgTAP RLS tests: storage.objects (avatars bucket)
-- Purpose: Verify avatar storage self-scoped access policies
-- Related: Story 1.5 AC#4, #5, #6
-- Note: Supabase prevents direct DELETE from storage.objects via trigger.
--        Delete tests must use the Storage API. Here we test INSERT/SELECT only.

BEGIN;

CREATE OR REPLACE FUNCTION reset_role() RETURNS void AS $$
BEGIN
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '', false);
END;
$$ LANGUAGE plpgsql;

SELECT plan(6);

SET ROLE postgres;
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'pgtap-avatar-a@test.com', '{}', '{}'),
  ('22222222-2222-2222-2222-222222222222', 'pgtap-avatar-b@test.com', '{}', '{}')
ON CONFLICT (id) DO NOTHING;
RESET ROLE;

-- User A can upload to own folder
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', false);
SELECT lives_ok(
  $$INSERT INTO storage.objects (bucket_id, name, metadata) VALUES ('avatars', '11111111-1111-1111-1111-111111111111/test.jpg', '{"mimetype": "image/jpeg"}')$$,
  'User A can upload to own avatar folder'
);
SELECT reset_role();

-- User A can read own avatar
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}', false);
SELECT is(
  (SELECT count(*) FROM storage.objects WHERE bucket_id = 'avatars' AND name LIKE '11111111-1111-1111-1111-111111111111/%'),
  1::bigint,
  'User A sees own avatar'
);
SELECT reset_role();

-- User B cannot read User A avatars
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222"}', false);
SELECT is(
  (SELECT count(*) FROM storage.objects WHERE bucket_id = 'avatars' AND name LIKE '11111111-1111-1111-1111-111111111111/%'),
  0::bigint,
  'User B cannot see User A avatars'
);
SELECT reset_role();

-- User B cannot upload to User A folder
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222"}', false);
SELECT throws_ok(
  $$INSERT INTO storage.objects (bucket_id, name, metadata) VALUES ('avatars', '11111111-1111-1111-1111-111111111111/hack.jpg', '{"mimetype": "image/jpeg"}')$$,
  42501
);
SELECT reset_role();

-- User B cannot upload a second file to User A folder either
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222"}', false);
SELECT throws_ok(
  $$INSERT INTO storage.objects (bucket_id, name, metadata) VALUES ('avatars', '11111111-1111-1111-1111-111111111111/test2.jpg', '{"mimetype": "image/jpeg"}')$$,
  42501
);
SELECT reset_role();

-- Unauthenticated sees nothing
SET ROLE anon;
SELECT set_config('request.jwt.claims', '{}', false);
SELECT is(
  (SELECT count(*) FROM storage.objects WHERE bucket_id = 'avatars'),
  0::bigint,
  'Unauthenticated sees no avatars'
);
SELECT reset_role();

SELECT * FROM finish();
ROLLBACK;
