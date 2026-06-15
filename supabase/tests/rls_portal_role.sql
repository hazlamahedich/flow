-- pgTAP RLS tests for the `portal` role (cross-table isolation)
-- Story 9.1a: Client Portal Auth & Layout (FR54 — strict data isolation)
--
-- This test file verifies the `portal` role RLS pattern that 9-2 will mirror
-- on invoices/reports/etc. For 9-1a we exercise it on `clients` and
-- `portal_tokens` — the tables where the policy lives today.
--
-- Run via: PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
--          -f supabase/tests/rls_portal_role.sql

BEGIN;

SELECT plan(13);

-- ───────────────────────────────────────────────────────────────
-- Setup: Workspace + users + clients
-- ───────────────────────────────────────────────────────────────

DELETE FROM portal_tokens WHERE workspace_id IN (
  SELECT id FROM workspaces WHERE slug LIKE 'rls_prt_%'
);

INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001', 'prt_owner@test.com', '{}', now(), now()),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002', 'prt_member@test.com', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, name, created_at, updated_at)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001', 'prt_owner@test.com', 'PRT Owner', now(), now()),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002', 'prt_member@test.com', 'PRT Member', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspaces (id, name, slug, created_by, created_at)
VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001', 'rls_prt_ws_a', 'rls-prt-ws-a', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001', now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb002', 'rls_prt_ws_b', 'rls-prt-ws-b', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001', now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role, joined_at)
VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001', 'owner', now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002', 'member', now())
ON CONFLICT DO NOTHING;

INSERT INTO clients (id, workspace_id, name, status, created_at)
VALUES
  ('cccccccc-cccc-cccc-cccc-ccccccccc001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001', 'PRT Client A1', 'active', now()),
  ('cccccccc-cccc-cccc-cccc-ccccccccc002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001', 'PRT Client A2', 'active', now()),
  ('cccccccc-cccc-cccc-cccc-ccccccccc003', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb002', 'PRT Client B1', 'active', now())
ON CONFLICT (id) DO NOTHING;

-- Seed a REDEEMED portal token for client A1. The portal-role policy on
-- `clients` requires `used_at IS NOT NULL` — only redeemed tokens grant
-- portal access (unlike the `portal_tokens` policy which excludes used tokens).
INSERT INTO portal_tokens (id, token_hash, client_id, workspace_id, expires_at, used_at, created_by_user_id)
VALUES (
  'dddddddd-dddd-dddd-dddd-ddddddddd001',
  encode(digest('prt-token-a1-redeemed-1234567890123', 'sha256'), 'hex'),
  'cccccccc-cccc-cccc-cccc-ccccccccc001',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001',
  now() + interval '24 hours',
  now(),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001'
)
ON CONFLICT (id) DO UPDATE SET
  used_at = now(),
  revoked_at = NULL,
  expires_at = now() + interval '24 hours';

-- ───────────────────────────────────────────────────────────────
-- Test 1: portal role exists with NOLOGIN
-- ───────────────────────────────────────────────────────
SELECT is(
  (SELECT rolcanlogin FROM pg_roles WHERE rolname = 'portal'),
  false,
  'portal role exists with NOLOGIN (JWT-claims-only access)'
);

-- ───────────────────────────────────────────────────────────────
-- Test 2: portal role is granted SELECT on portal-facing tables
-- ───────────────────────────────────────────────────────
SELECT ok(
  has_table_privilege('portal', 'portal_tokens', 'SELECT'),
  'portal role has SELECT on portal_tokens'
);
SELECT ok(
  has_table_privilege('portal', 'clients', 'SELECT'),
  'portal role has SELECT on clients'
);

-- ───────────────────────────────────────────────────────────────
-- Test 3: portal role with valid claim SELECTs the matching client only
-- ───────────────────────────────────────────────────────
-- The JWT carries role=portal, client_id=cccccccc-...-001, portal_token_id=dddddddd-...-001.
-- RLS policy on `clients` checks both the client_id match AND that the
-- portal_tokens row is valid (used, not revoked, not expired).
SET request.jwt.claims = '{"role":"portal","client_id":"cccccccc-cccc-cccc-cccc-ccccccccc001","portal_token_id":"dddddddd-dddd-dddd-dddd-ddddddddd001","workspace_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001"}';
SET ROLE portal;

SELECT results_eq(
  $$SELECT id::text FROM clients ORDER BY id$$,
  $$VALUES ('cccccccc-cccc-cccc-cccc-ccccccccc001'::text)$$,
  'portal role reads only the JWT-matching client (strict isolation — FR54)'
);

RESET ROLE;

-- ───────────────────────────────────────────────────────────────
-- Test 4: portal role with WRONG client_id claim sees nothing
-- ───────────────────────────────────────────────────────
SET request.jwt.claims = '{"role":"portal","client_id":"cccccccc-cccc-cccc-cccc-ccccccccc002","portal_token_id":"dddddddd-dddd-dddd-dddd-ddddddddd001","workspace_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001"}';
SET ROLE portal;

SELECT is_empty(
  $$SELECT * FROM clients$$,
  'portal role with mismatched client_id vs portal_token_id sees nothing (FR54)'
);

RESET ROLE;

-- ───────────────────────────────────────────────────────────────
-- Test 5: portal role with token from different workspace sees nothing
-- ───────────────────────────────────────────────────────
SET request.jwt.claims = '{"role":"portal","client_id":"cccccccc-cccc-cccc-cccc-ccccccccc003","portal_token_id":"dddddddd-dddd-dddd-dddd-ddddddddd001","workspace_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001"}';
SET ROLE portal;

SELECT is_empty(
  $$SELECT * FROM clients$$,
  'portal role with token from different workspace sees nothing (cross-workspace block)'
);

RESET ROLE;

-- ───────────────────────────────────────────────────────────────
-- Test 6: portal role with UNREDEEMED token sees nothing
-- ───────────────────────────────────────────────────────
-- The clients policy requires used_at IS NOT NULL. A token that was generated
-- but never validated through verify_portal_token must not seed portal access.
SET LOCAL ROLE service_role;
INSERT INTO portal_tokens (id, token_hash, client_id, workspace_id, expires_at, created_by_user_id)
VALUES (
  'dddddddd-dddd-dddd-dddd-ddddddddd002',
  encode(digest('prt-token-unused-1234567890123456789', 'sha256'), 'hex'),
  'cccccccc-cccc-cccc-cccc-ccccccccc002',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001',
  now() + interval '72 hours',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001'
)
ON CONFLICT (id) DO UPDATE SET used_at = NULL;
RESET ROLE;

SET request.jwt.claims = '{"role":"portal","client_id":"cccccccc-cccc-cccc-cccc-ccccccccc002","portal_token_id":"dddddddd-dddd-dddd-dddd-ddddddddd002","workspace_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001"}';
SET ROLE portal;

SELECT is_empty(
  $$SELECT * FROM clients$$,
  'portal role with unredeemed token (used_at NULL) sees nothing'
);

RESET ROLE;

-- ───────────────────────────────────────────────────────────────
-- Test 7: portal role with REVOKED token sees nothing (EC4)
-- ───────────────────────────────────────────────────────
SET LOCAL ROLE service_role;
UPDATE portal_tokens
  SET revoked_at = now(), used_at = now()
  WHERE id = 'dddddddd-dddd-dddd-dddd-ddddddddd001';
RESET ROLE;

SET request.jwt.claims = '{"role":"portal","client_id":"cccccccc-cccc-cccc-cccc-ccccccccc001","portal_token_id":"dddddddd-dddd-dddd-dddd-ddddddddd001","workspace_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001"}';
SET ROLE portal;

SELECT is_empty(
  $$SELECT * FROM clients$$,
  'portal role with revoked token sees nothing (EC4 — revocation invalidates active sessions)'
);

-- Reset revocation for downstream tests
RESET ROLE;
SET LOCAL ROLE service_role;
UPDATE portal_tokens SET revoked_at = NULL WHERE id = 'dddddddd-dddd-dddd-dddd-ddddddddd001';
RESET ROLE;

-- ───────────────────────────────────────────────────────────────
-- Test 8: portal role with EXPIRED token sees nothing (EC3)
-- ───────────────────────────────────────────────────────
SET LOCAL ROLE service_role;
UPDATE portal_tokens SET expires_at = now() - interval '1 hour' WHERE id = 'dddddddd-dddd-dddd-dddd-ddddddddd001';
RESET ROLE;

SET request.jwt.claims = '{"role":"portal","client_id":"cccccccc-cccc-cccc-cccc-ccccccccc001","portal_token_id":"dddddddd-dddd-dddd-dddd-ddddddddd001","workspace_id":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001"}';
SET ROLE portal;

SELECT is_empty(
  $$SELECT * FROM clients$$,
  'portal role with expired token sees nothing (EC3)'
);

RESET ROLE;

-- Restore expiry for downstream
SET LOCAL ROLE service_role;
UPDATE portal_tokens SET expires_at = now() + interval '24 hours' WHERE id = 'dddddddd-dddd-dddd-dddd-ddddddddd001';
RESET ROLE;

-- ───────────────────────────────────────────────────────────────
-- Test 10: portal role cannot write to portal_tokens (no INSERT privilege)
-- ───────────────────────────────────────────────────────
-- We don't grant INSERT to portal — only SELECT. Confirm via privilege check
-- (more reliable than throws_ok which wants a specific error string).
SELECT ok(
  NOT has_table_privilege('portal', 'portal_tokens', 'INSERT'),
  'portal role lacks INSERT on portal_tokens (read-only — no direct writes)'
);

-- ───────────────────────────────────────────────────────────────
-- Test 11: ::text cast is present in the portal role RLS policies
--         (project-context.md:118 — non-negotiable)
-- ───────────────────────────────────────────────────────
-- The clients policy uses `id::text` (the clients PK), not `client_id::text`
-- (clients table has no client_id column — it IS the client).
SELECT is(
  (SELECT count(*) FROM pg_policies
   WHERE tablename = 'clients'
     AND policyname = 'rls_clients_portal_select'
     AND qual LIKE '%id)%text%'),
  1::bigint,
  'clients portal_select policy uses ::text cast on id (project-context.md:118)'
);

-- ───────────────────────────────────────────────────────────────
-- Test 11: verify_portal_token RPC is SECURITY DEFINER + grants to anon
-- ───────────────────────────────────────────────────────
SELECT is(
  (SELECT prosecdef FROM pg_proc WHERE proname = 'verify_portal_token'),
  true,
  'verify_portal_token is SECURITY DEFINER (anon callable, table bypass for lookup only)'
);

SELECT ok(
  has_function_privilege('anon', 'verify_portal_token(text)', 'execute'),
  'anon role has EXECUTE on verify_portal_token (clients have no Supabase Auth session)'
);

-- ───────────────────────────────────────────────────────────────
-- Cleanup
-- ───────────────────────────────────────────────────────
RESET request.jwt.claims;

SELECT * FROM finish();
ROLLBACK;
