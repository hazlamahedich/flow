-- pgTAP RLS tests for portal_tokens table + verify_portal_token RPC
-- Story 9.1a: Client Portal Auth & Layout (FR8, FR51, FR54)
--
-- Run via: PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
--          -f supabase/tests/rls_portal_tokens.sql
-- (Docker mount issue — do NOT use `supabase test db`.)

BEGIN;

SELECT plan(17);

-- ───────────────────────────────────────────────────────────────
-- Setup: Create test workspace, users, roles, and clients
-- ───────────────────────────────────────────────────────────────

-- Clean up any previous test data (idempotent re-runs)
DELETE FROM portal_tokens WHERE workspace_id IN (
  SELECT id FROM workspaces WHERE slug LIKE 'rls_ptest_%'
);
DELETE FROM clients WHERE workspace_id IN (
  SELECT id FROM workspaces WHERE slug LIKE 'rls_ptest_%'
);

-- Create test users (auth.users FK)
INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at)
VALUES
  ('55555555-5555-5555-5555-555555550001', 'pt_owner@test.com', '{"full_name":"PTest Owner"}', now(), now()),
  ('55555555-5555-5555-5555-555555550002', 'pt_admin@test.com', '{"full_name":"PTest Admin"}', now(), now()),
  ('55555555-5555-5555-5555-555555550003', 'pt_member@test.com', '{"full_name":"PTest Member"}', now(), now()),
  ('55555555-5555-5555-5555-555555550004', 'pt_other@test.com', '{"full_name":"PTest Other"}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, name, created_at, updated_at)
VALUES
  ('55555555-5555-5555-5555-555555550001', 'pt_owner@test.com', 'PTest Owner', now(), now()),
  ('55555555-5555-5555-5555-555555550002', 'pt_admin@test.com', 'PTest Admin', now(), now()),
  ('55555555-5555-5555-5555-555555550003', 'pt_member@test.com', 'PTest Member', now(), now()),
  ('55555555-5555-5555-5555-555555550004', 'pt_other@test.com', 'PTest Other', now(), now())
ON CONFLICT (id) DO NOTHING;

-- Test workspaces (A + B)
INSERT INTO workspaces (id, name, slug, created_by, created_at)
VALUES
  ('66666666-6666-6666-6666-666666660001', 'rls_ptest_ws_a', 'rls-ptest-ws-a', '55555555-5555-5555-5555-555555550001', now()),
  ('66666666-6666-6666-6666-666666660002', 'rls_ptest_ws_b', 'rls-ptest-ws-b', '55555555-5555-5555-5555-555555550004', now())
ON CONFLICT (id) DO NOTHING;

-- Workspace memberships
INSERT INTO workspace_members (workspace_id, user_id, role, joined_at)
VALUES
  ('66666666-6666-6666-6666-666666660001', '55555555-5555-5555-5555-555555550001', 'owner', now()),
  ('66666666-6666-6666-6666-666666660001', '55555555-5555-5555-5555-555555550002', 'admin', now()),
  ('66666666-6666-6666-6666-666666660001', '55555555-5555-5555-5555-555555550003', 'member', now()),
  ('66666666-6666-6666-6666-666666660002', '55555555-5555-5555-5555-555555550004', 'owner', now())
ON CONFLICT DO NOTHING;

-- Test clients in each workspace
INSERT INTO clients (id, workspace_id, name, status, created_at)
VALUES
  ('77777777-7777-7777-7777-777777770001', '66666666-6666-6666-6666-666666660001', 'PTest Client A', 'active', now()),
  ('77777777-7777-7777-7777-777777770002', '66666666-6666-6666-6666-666666660002', 'PTest Client B', 'active', now())
ON CONFLICT (id) DO NOTHING;

-- ───────────────────────────────────────────────────────────────
-- Test 1: Table exists with correct structure
-- ───────────────────────────────────────────────────────────────
SELECT has_table('portal_tokens', 'portal_tokens table exists');
SELECT has_column('portal_tokens', 'token_hash', 'portal_tokens.token_hash exists');
SELECT has_column('portal_tokens', 'client_id', 'portal_tokens.client_id exists');
SELECT has_column('portal_tokens', 'used_at', 'portal_tokens.used_at exists');
SELECT has_column('portal_tokens', 'revoked_at', 'portal_tokens.revoked_at exists');

-- ───────────────────────────────────────────────────────────────
-- Test 2: RLS is enabled
-- ───────────────────────────────────────────────────────────────
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'portal_tokens'),
  true,
  'RLS is enabled on portal_tokens'
);

-- ───────────────────────────────────────────────────────────────
-- Seed a token row as superuser for downstream tests
-- ───────────────────────────────────────────────────────────────
-- token_hash is sha256 of 'ptest-token-a-12345678901234567890'
-- precomputed so test is deterministic
INSERT INTO portal_tokens (id, token_hash, client_id, workspace_id, expires_at, created_by_user_id)
VALUES (
  '88888888-8888-8888-8888-888888880001',
  encode(digest('ptest-token-a-12345678901234567890', 'sha256'), 'hex'),
  '77777777-7777-7777-7777-777777770001',
  '66666666-6666-6666-6666-666666660001',
  now() + interval '72 hours',
  '55555555-5555-5555-5555-555555550001'
)
ON CONFLICT (id) DO UPDATE SET
  token_hash = EXCLUDED.token_hash,
  used_at = NULL,
  revoked_at = NULL,
  expires_at = EXCLUDED.expires_at;

-- ───────────────────────────────────────────────────────────────
-- Test 3: Owner can SELECT tokens in their workspace
-- ───────────────────────────────────────────────────────────────
SET request.jwt.claims = '{"workspace_id": "66666666-6666-6666-6666-666666660001", "role": "owner", "sub": "55555555-5555-5555-5555-555555550001"}';
SET ROLE authenticated;

SELECT lives_ok(
  $$SELECT * FROM portal_tokens WHERE workspace_id = '66666666-6666-6666-6666-666666660001'$$,
  'Owner can SELECT portal_tokens in their workspace'
);

RESET ROLE;

-- ───────────────────────────────────────────────────────────────
-- Test 4: Admin can SELECT tokens (admin is also allowed)
-- ───────────────────────────────────────────────────────────────
SET request.jwt.claims = '{"workspace_id": "66666666-6666-6666-6666-666666660001", "role": "admin", "sub": "55555555-5555-5555-5555-555555550002"}';
SET ROLE authenticated;

SELECT lives_ok(
  $$SELECT * FROM portal_tokens WHERE workspace_id = '66666666-6666-6666-6666-666666660001'$$,
  'Admin can SELECT portal_tokens in their workspace'
);

RESET ROLE;

-- ───────────────────────────────────────────────────────────────
-- Test 5: Member CANNOT SELECT tokens (link management is Owner/Admin-only)
-- ───────────────────────────────────────────────────────────────
SET request.jwt.claims = '{"workspace_id": "66666666-6666-6666-6666-666666660001", "role": "member", "sub": "55555555-5555-5555-5555-555555550003"}';
SET ROLE authenticated;

SELECT is_empty(
  $$SELECT * FROM portal_tokens WHERE workspace_id = '66666666-6666-6666-6666-666666660001'$$,
  'Member sees zero portal_tokens (Owner/Admin only)'
);

RESET ROLE;

-- ───────────────────────────────────────────────────────────────
-- Test 6: Cross-workspace isolation — WS A owner cannot see WS B tokens
-- ───────────────────────────────────────────────────────────────
SET request.jwt.claims = '{"workspace_id": "66666666-6666-6666-6666-666666660001", "role": "owner", "sub": "55555555-5555-5555-5555-555555550001"}';
SET ROLE authenticated;

SELECT is_empty(
  $$SELECT * FROM portal_tokens WHERE workspace_id = '66666666-6666-6666-6666-666666660002'$$,
  'Workspace A owner sees zero portal_tokens from Workspace B (FR54)'
);

RESET ROLE;

-- ───────────────────────────────────────────────────────────────
-- Test 7: Anon CANNOT directly SELECT portal_tokens (forced through RPC)
-- ───────────────────────────────────────────────────────────────
SET request.jwt.claims = '{}';
RESET ROLE;
SET ROLE anon;

SELECT is_empty(
  $$SELECT * FROM portal_tokens$$,
  'Anon cannot directly SELECT portal_tokens (must use verify_portal_token RPC)'
);

RESET ROLE;

-- ───────────────────────────────────────────────────────────────
-- Test 8: verify_portal_token — valid first-use returns context + stamps used_at
-- ───────────────────────────────────────────────────────────────
SET ROLE anon;

SELECT results_eq(
  $$SELECT client_id::text, workspace_id::text FROM verify_portal_token('ptest-token-a-12345678901234567890')$$,
  $$VALUES ('77777777-7777-7777-7777-777777770001'::text, '66666666-6666-6666-6666-666666660001'::text)$$,
  'verify_portal_token returns correct client+workspace on first use'
);

-- Verify used_at was stamped. Switch to service_role to bypass RLS on the
-- verification read (anon has no SELECT on portal_tokens — that's the point).
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT is(
  (SELECT used_at IS NOT NULL FROM portal_tokens WHERE id = '88888888-8888-8888-8888-888888880001'),
  true,
  'verify_portal_token stamped used_at (single-use consumption)'
);
RESET ROLE;

RESET ROLE;

-- ───────────────────────────────────────────────────────────────
-- Test 9: verify_portal_token — second call returns empty (single-use)
-- ───────────────────────────────────────────────────────────────
SET ROLE anon;

SELECT is_empty(
  $$SELECT * FROM verify_portal_token('ptest-token-a-12345678901234567890')$$,
  'verify_portal_token returns empty on second call (single-use — EC2)'
);

RESET ROLE;

-- ───────────────────────────────────────────────────────────────
-- Test 10: verify_portal_token — unknown token returns empty (no enumeration)
-- ───────────────────────────────────────────────────────────────
SET ROLE anon;

SELECT is_empty(
  $$SELECT * FROM verify_portal_token('completely-unknown-token-zzzz-1234567890')$$,
  'verify_portal_token returns empty for unknown token (no enumeration — EC3/EC4)'
);

RESET ROLE;

-- ───────────────────────────────────────────────────────────────
-- Test 11: verify_portal_token — expired token returns empty (EC3)
-- ───────────────────────────────────────────────────────
SET LOCAL ROLE service_role;
INSERT INTO portal_tokens (id, token_hash, client_id, workspace_id, expires_at, created_by_user_id)
VALUES (
  '88888888-8888-8888-8888-888888880002',
  encode(digest('ptest-token-expired-123456789012345', 'sha256'), 'hex'),
  '77777777-7777-7777-7777-777777770001',
  '66666666-6666-6666-6666-666666660001',
  now() - interval '1 hour',
  '55555555-5555-5555-5555-555555550001'
)
ON CONFLICT (id) DO UPDATE SET expires_at = now() - interval '1 hour', used_at = NULL, revoked_at = NULL;
RESET ROLE;

SET ROLE anon;

SELECT is_empty(
  $$SELECT * FROM verify_portal_token('ptest-token-expired-123456789012345')$$,
  'verify_portal_token returns empty for expired token (EC3)'
);

RESET ROLE;

-- ───────────────────────────────────────────────────────────────
-- Test 12: verify_portal_token — revoked token returns empty (EC4)
-- ───────────────────────────────────────────────────────
SET LOCAL ROLE service_role;
INSERT INTO portal_tokens (id, token_hash, client_id, workspace_id, expires_at, revoked_at, created_by_user_id)
VALUES (
  '88888888-8888-8888-8888-888888880003',
  encode(digest('ptest-token-revoked-123456789012345', 'sha256'), 'hex'),
  '77777777-7777-7777-7777-777777770001',
  '66666666-6666-6666-6666-666666660001',
  now() + interval '72 hours',
  now(),
  '55555555-5555-5555-5555-555555550001'
)
ON CONFLICT (id) DO UPDATE SET revoked_at = now(), used_at = NULL;
RESET ROLE;

SET ROLE anon;

SELECT is_empty(
  $$SELECT * FROM verify_portal_token('ptest-token-revoked-123456789012345')$$,
  'verify_portal_token returns empty for revoked token (EC4)'
);

RESET ROLE;

-- ───────────────────────────────────────────────────────────────
-- Cleanup
-- ───────────────────────────────────────────────────────────────
RESET request.jwt.claims;

SELECT * FROM finish();
ROLLBACK;
