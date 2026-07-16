-- E2E test user seed
-- Purpose: create the three users the Playwright global setup expects.
-- Loaded via psql after `supabase db reset` in CI.

SELECT set_config('seed.pw_hash', '$2a$10$0rEBnLdLWw8qle5flIgvLu3hzwgXvTPARczGzOoH7uvmNel.gLJSS', false);

DO $$
DECLARE
  v_workspace_id uuid;
  v_instance_id uuid := '00000000-0000-0000-0000-000000000000';
  v_owner_id uuid;
  v_admin_id uuid;
  v_member_id uuid;
  v_password_hash text := current_setting('seed.pw_hash');
BEGIN
  -- test-workspace
  INSERT INTO workspaces (id, name, slug)
  VALUES ('00000000-0000-0000-0000-000000000001', 'Test Workspace', 'test-workspace')
  ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name;

  SELECT id INTO v_workspace_id FROM workspaces WHERE slug = 'test-workspace' LIMIT 1;

  -- clean up any stale seed rows with the target emails
  DELETE FROM auth.identities
  WHERE user_id IN (SELECT id FROM auth.users WHERE email IN ('owner@test.com', 'admin@test.com', 'member@test.com'));

  DELETE FROM workspace_members
  WHERE user_id IN (SELECT id FROM auth.users WHERE email IN ('owner@test.com', 'admin@test.com', 'member@test.com'));

  DELETE FROM users
  WHERE email IN ('owner@test.com', 'admin@test.com', 'member@test.com');

  DELETE FROM auth.users
  WHERE email IN ('owner@test.com', 'admin@test.com', 'member@test.com');

  -- create test users in auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change_token_current,
    phone_change_token,
    reauthentication_token,
    email_change,
    phone_change,
    phone,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data
  )
  VALUES
    (v_instance_id, gen_random_uuid(), 'authenticated', 'authenticated', 'owner@test.com', v_password_hash, now(), '', '', '', '', '', '', '', '', NULL, now(), now(), jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')), jsonb_build_object('email_verified', true))
  RETURNING id INTO v_owner_id;

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change_token_current,
    phone_change_token,
    reauthentication_token,
    email_change,
    phone_change,
    phone,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data
  )
  VALUES
    (v_instance_id, gen_random_uuid(), 'authenticated', 'authenticated', 'admin@test.com', v_password_hash, now(), '', '', '', '', '', '', '', '', NULL, now(), now(), jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')), jsonb_build_object('email_verified', true))
  RETURNING id INTO v_admin_id;

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change_token_current,
    phone_change_token,
    reauthentication_token,
    email_change,
    phone_change,
    phone,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data
  )
  VALUES
    (v_instance_id, gen_random_uuid(), 'authenticated', 'authenticated', 'member@test.com', v_password_hash, now(), '', '', '', '', '', '', '', '', NULL, now(), now(), jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')), jsonb_build_object('email_verified', true))
  RETURNING id INTO v_member_id;

  -- identities required for GoTrue password sign-in
  INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
  VALUES
    (v_owner_id::text, v_owner_id, jsonb_build_object('sub', v_owner_id::text, 'email', 'owner@test.com', 'email_verified', true, 'phone_verified', false), 'email', now(), now()),
    (v_admin_id::text, v_admin_id, jsonb_build_object('sub', v_admin_id::text, 'email', 'admin@test.com', 'email_verified', true, 'phone_verified', false), 'email', now(), now()),
    (v_member_id::text, v_member_id, jsonb_build_object('sub', v_member_id::text, 'email', 'member@test.com', 'email_verified', true, 'phone_verified', false), 'email', now(), now());

  -- public profiles
  INSERT INTO users (id, email, name, timezone)
  VALUES
    (v_owner_id, 'owner@test.com', 'owner', 'UTC'),
    (v_admin_id, 'admin@test.com', 'admin', 'UTC'),
    (v_member_id, 'member@test.com', 'member', 'UTC');

  -- workspace memberships
  INSERT INTO workspace_members (workspace_id, user_id, role, status)
  VALUES
    (v_workspace_id, v_owner_id, 'owner', 'active'),
    (v_workspace_id, v_admin_id, 'admin', 'active'),
    (v_workspace_id, v_member_id, 'member', 'active');
END $$;
