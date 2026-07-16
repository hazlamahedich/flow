-- pgTAP tests: subscription orchestrator guard perimeter (Story 9.5b T7.3)
-- Purpose: Verify REAL RLS perimeter assertions per Winston A10:
--          (1) cross-workspace owner DENIED reading another workspace's
--              subscription_status;
--          (2) archived-client UPDATE affects 0 rows even for workspace owner
--              (RLS — migration 20260618800001);
--          (3) non-owner member denied UPDATE on active client;
--          (4) owner CAN update active client (positive control);
--          (5) service_role can update archived client (only legitimate mutator).
-- Related: Story 9.5b AC3 — FR57 client half
-- Run: PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
--        -c "CREATE EXTENSION IF NOT EXISTS pgtap;" \
--        -f supabase/tests/rls_subscription_orchestrator_guard.sql

BEGIN;

CREATE OR REPLACE FUNCTION reset_role() RETURNS void AS $$
BEGIN
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '', false);
END;
$$ LANGUAGE plpgsql;

SELECT plan(6);

-- ── Test data ──
-- Owner A (workspace ws-a) + Member B (workspace ws-b) + their clients.
-- ws-a has an ACTIVE client + an ARCHIVED client (post-downgrade).
-- ws-b is unrelated.
INSERT INTO workspaces (id, name, slug, subscription_status, subscription_tier) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'WS A', 'pgtap-orch-ws-a', 'active', 'free'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'WS B', 'pgtap-orch-ws-b', 'active', 'free')
ON CONFLICT (id) DO UPDATE SET
  subscription_status = EXCLUDED.subscription_status,
  subscription_tier = EXCLUDED.subscription_tier;

-- Two owner users in workspace ws-a + one member user in ws-a (for negative control).
INSERT INTO auth.users (id, email) VALUES
  ('11111111-aaaa-aaaa-aaaa-111111111111', 'pgtap-orch-owner-a@example.test'),
  ('22222222-bbbb-bbbb-bbbb-222222222222', 'pgtap-orch-owner-b@example.test'),
  ('33333333-cccc-cccc-cccc-333333333333', 'pgtap-orch-member-a@example.test')
ON CONFLICT (id) DO NOTHING;

-- Create public users records to satisfy workspace_members FK.
INSERT INTO users (id, email, name, timezone) VALUES
  ('11111111-aaaa-aaaa-aaaa-111111111111', 'pgtap-orch-owner-a@example.test', 'owner-a', 'UTC'),
  ('22222222-bbbb-bbbb-bbbb-222222222222', 'pgtap-orch-owner-b@example.test', 'owner-b', 'UTC'),
  ('33333333-cccc-cccc-cccc-333333333333', 'pgtap-orch-member-a@example.test', 'member-a', 'UTC')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role, status) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-aaaa-aaaa-aaaa-111111111111', 'owner', 'active'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-cccc-cccc-cccc-333333333333', 'member', 'active'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-bbbb-bbbb-bbbb-222222222222', 'owner', 'active')
ON CONFLICT DO NOTHING;

-- Clients in ws-a: one active, one archived.
INSERT INTO clients (id, workspace_id, name, status, archived_at) VALUES
  ('cccccccc-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Active Client', 'active', NULL),
  ('cccccccc-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Archived Client', 'archived', now())
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  archived_at = EXCLUDED.archived_at,
  name = EXCLUDED.name,
  workspace_id = EXCLUDED.workspace_id;

-- ════════════════════════════════════════════════════════════════
-- 1. Cross-workspace owner DENIED reading another workspace's subscription_status
--    (Winston A10 #1 — RLS perimeter for subscription_status column)
-- ════════════════════════════════════════════════════════════════
SET ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '11111111-aaaa-aaaa-aaaa-111111111111',
    'workspace_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'role', 'owner'
  )::text,
  false
);
SELECT is(
  (SELECT count(*)::int FROM workspaces
     WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
       -- the workspace_members existence check in the SELECT policy rejects ws-b
  ),
  0,
  'owner of ws-a CANNOT see ws-b''s subscription_status (cross-workspace RLS)'
);
SELECT reset_role();

-- ════════════════════════════════════════════════════════════════
-- 2. Archived-client UPDATE affects 0 rows even for workspace owner
--    (RLS — migration 20260618800001 added `status = 'active'` to UPDATE policy)
-- ════════════════════════════════════════════════════════════════
SET ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '11111111-aaaa-aaaa-aaaa-111111111111',
    'workspace_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'role', 'owner'
  )::text,
  false
);
-- Update attempt on the archived client → 0 rows affected.
WITH update_result AS (
  UPDATE clients SET name = 'Should Not Update'
   WHERE id = 'cccccccc-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  RETURNING id
)
SELECT is(
  (SELECT count(*)::int FROM update_result),
  0,
  'archived-client UPDATE affects 0 rows even for workspace owner (RLS guards UPDATE)'
);
-- Verify the row was NOT mutated.
SELECT is(
  (SELECT name FROM clients WHERE id = 'cccccccc-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  'Archived Client',
  'archived client name unchanged after rejected UPDATE'
);
SELECT reset_role();

-- ════════════════════════════════════════════════════════════════
-- 3. Non-owner member denied UPDATE on active client
-- ════════════════════════════════════════════════════════════════
SET ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '33333333-cccc-cccc-cccc-333333333333',
    'workspace_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'role', 'member'
  )::text,
  false
);
WITH update_result AS (
  UPDATE clients SET name = 'Member Tried Rename'
   WHERE id = 'cccccccc-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
     AND status = 'active'
  RETURNING id
)
SELECT is(
  (SELECT count(*)::int FROM update_result),
  0,
  'non-owner member cannot UPDATE active client (RLS role guard)'
);
SELECT reset_role();

-- ════════════════════════════════════════════════════════════════
-- 4. Owner CAN update active client (positive control — guard works)
-- ════════════════════════════════════════════════════════════════
SET ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '11111111-aaaa-aaaa-aaaa-111111111111',
    'workspace_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'role', 'owner'
  )::text,
  false
);
WITH update_result AS (
  UPDATE clients SET name = 'Active Client Renamed'
   WHERE id = 'cccccccc-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
     AND status = 'active'
  RETURNING id
)
SELECT is(
  (SELECT count(*)::int FROM update_result),
  1,
  'owner CAN update an active client in their own workspace (positive control)'
);
SELECT reset_role();

-- ════════════════════════════════════════════════════════════════
-- 5. service_role CAN update archived client (the only legitimate mutator —
--    webhook path bypasses RLS to perform bulk archive / unarchive)
-- ════════════════════════════════════════════════════════════════
SET ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role": "service_role"}', false);
WITH update_result AS (
  UPDATE clients SET name = 'Archived Client (service_role touched)'
   WHERE id = 'cccccccc-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  RETURNING id
)
SELECT is(
  (SELECT count(*)::int FROM update_result),
  1,
  'service_role CAN update archived client (webhook bypasses RLS — bulkArchiveClients)'
);
SELECT reset_role();

-- Cleanup
DELETE FROM clients WHERE id IN (
  'cccccccc-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'cccccccc-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
);
DELETE FROM workspace_members WHERE workspace_id IN (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
) AND user_id IN (
  '11111111-aaaa-aaaa-aaaa-111111111111',
  '22222222-bbbb-bbbb-bbbb-222222222222',
  '33333333-cccc-cccc-cccc-333333333333'
);
DELETE FROM auth.users WHERE id IN (
  '11111111-aaaa-aaaa-aaaa-111111111111',
  '22222222-bbbb-bbbb-bbbb-222222222222',
  '33333333-cccc-cccc-cccc-333333333333'
);
DELETE FROM workspaces WHERE id IN (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
);

SELECT * FROM finish();
ROLLBACK;
