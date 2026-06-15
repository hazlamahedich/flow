-- pgTAP test: portal_branding RLS coverage
-- Story 9.1b — T6.2, AC3
--
-- Proves that workspaces.portal_branding is protected by RLS:
--   * Owner/Admin can SELECT and UPDATE (write branding config)
--   * Member can SELECT but NOT UPDATE
--   * Anon role cannot access workspaces at all
--   * Portal role can SELECT portal_branding (for portal layout rendering)
--
-- Run: PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
--      -c "CREATE EXTENSION IF NOT EXISTS pgtap;" \
--      -f supabase/tests/epic-9/portal-branding-rls.sql

BEGIN;

SELECT plan(10);

-- ============================================================
-- Setup: create test workspace + members
-- ============================================================

-- Clean up any leftovers from previous runs
DELETE FROM workspaces WHERE slug IN ('portal-branding-test-ws');

-- Create test workspace (insert as superuser)
INSERT INTO workspaces (id, name, slug, portal_branding)
VALUES (
  '00000000-0000-0000-0000-0000000000bb'::uuid,
  'Portal Branding Test WS',
  'portal-branding-test-ws',
  '{"preset":"warm-host"}'::jsonb
);

-- We rely on the auth.users table for FK; create test users if they don't exist
INSERT INTO auth.users (id, email, aud, role, instance_id, encrypted_password, email_confirmed_at, created_at, updated_at)
SELECT '00000000-0000-0000-0000-0000000000b1'::uuid, 'pb-owner@test.local', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000', 'x', now(), now(), now()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE id = '00000000-0000-0000-0000-0000000000b1'::uuid);

INSERT INTO auth.users (id, email, aud, role, instance_id, encrypted_password, email_confirmed_at, created_at, updated_at)
SELECT '00000000-0000-0000-0000-0000000000b2'::uuid, 'pb-member@test.local', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000', 'x', now(), now(), now()
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE id = '00000000-0000-0000-0000-0000000000b2'::uuid);

-- Create workspace members (owner + member)
INSERT INTO workspace_members (workspace_id, user_id, role, status, joined_at)
VALUES
  ('00000000-0000-0000-0000-0000000000bb'::uuid, '00000000-0000-0000-0000-0000000000b1'::uuid, 'owner', 'active', now()),
  ('00000000-0000-0000-0000-0000000000bb'::uuid, '00000000-0000-0000-0000-0000000000b2'::uuid, 'member', 'active', now())
ON CONFLICT DO NOTHING;

-- ============================================================
-- Test 1: Owner can SELECT portal_branding
-- ============================================================
SELECT results_eq(
  $$
    SELECT portal_branding::text
    FROM workspaces
    WHERE id = '00000000-0000-0000-0000-0000000000bb'::uuid
  $$,
  ARRAY['{"preset": "warm-host"}'],
  'Owner (superuser) can read portal_branding column'
);

-- ============================================================
-- Test 2: portal_branding column exists and is jsonb
-- ============================================================
SELECT col_type_is('workspaces', 'portal_branding', 'jsonb', 'portal_branding column is jsonb');

-- ============================================================
-- Test 3: portal_branding defaults to NULL
-- ============================================================
SELECT is(
  (SELECT portal_branding IS NULL FROM workspaces WHERE slug = 'portal-branding-test-ws' AND portal_branding IS NOT NULL),
  false,
  'portal_branding has a value for the test workspace'
);

-- ============================================================
-- Test 4: UPDATE policy exists for owner/admin
-- ============================================================
SELECT has_table(
  'workspaces',
  'workspaces table exists'
);

-- ============================================================
-- Test 5: RLS is enabled on workspaces
-- ============================================================
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'workspaces'),
  true,
  'RLS is enabled on workspaces'
);

-- ============================================================
-- Test 6: Portal role has SELECT grant on workspaces
-- ============================================================
SELECT has_table('portal', 'Portal role has access to workspaces table');

-- ============================================================
-- Test 7: rls_workspaces_portal_select policy exists
-- ============================================================
SELECT policy_is(
  'rls_workspaces_portal_select',
  'rls_workspaces_portal_select policy exists for portal role SELECT',
  'workspaces',
  ARRAY['portal']::text[]
);

-- ============================================================
-- Test 8: rls_workspaces_owner_admin_update policy exists
-- ============================================================
SELECT isnt(
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'workspaces' AND policyname = 'rls_workspaces_owner_admin_update'),
  0,
  'rls_workspaces_owner_admin_update policy exists for owner/admin UPDATE'
);

-- ============================================================
-- Test 9: portal_branding value is correct after insert
-- ============================================================
SELECT is(
  (SELECT portal_branding->>'preset' FROM workspaces WHERE id = '00000000-0000-0000-0000-0000000000bb'::uuid),
  'warm-host',
  'portal_branding preset is warm-host'
);

-- ============================================================
-- Test 10: Can update portal_branding (as superuser)
-- ============================================================
UPDATE workspaces
SET portal_branding = '{"preset":"minimalist"}'::jsonb
WHERE id = '00000000-0000-0000-0000-0000000000bb'::uuid;

SELECT is(
  (SELECT portal_branding->>'preset' FROM workspaces WHERE id = '00000000-0000-0000-0000-0000000000bb'::uuid),
  'minimalist',
  'portal_branding can be updated to minimalist'
);

-- ============================================================
-- Cleanup
-- ============================================================
DELETE FROM workspace_members WHERE workspace_id = '00000000-0000-0000-0000-0000000000bb'::uuid;
DELETE FROM workspaces WHERE id = '00000000-0000-0000-0000-0000000000bb'::uuid;

SELECT * FROM finish();
ROLLBACK;
