-- pgTAP tests: subscription lifecycle RPCs + CHECK constraint (Story 9.5a)
-- Purpose: Verify transition_workspace_subscription_status access control,
--          conditional-write semantics, and the extended CHECK constraint.
-- Related: Story 9.5a AC1 — migration 20260619000001
-- Run: PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
--        -c "CREATE EXTENSION IF NOT EXISTS pgtap;" \
--        -f supabase/tests/rls_subscription_lifecycle.sql

BEGIN;

CREATE OR REPLACE FUNCTION reset_role() RETURNS void AS $$
BEGIN
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '', false);
END;
$$ LANGUAGE plpgsql;

SELECT plan(10);

-- ── Test data: two workspaces in known lifecycle states ──
INSERT INTO workspaces (id, name, slug, subscription_status, subscription_tier) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Lifecycle WS', 'pgtap-lifecycle-ws', 'past_due', 'pro'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Suspended WS', 'pgtap-suspended-ws', 'suspended', 'pro')
ON CONFLICT (id) DO UPDATE SET
  subscription_status = EXCLUDED.subscription_status,
  subscription_tier = EXCLUDED.subscription_tier,
  subscription_updated_at = now();

-- ════════════════════════════════════════════════════════════════
-- 1. anon CANNOT call transition_workspace_subscription_status
-- ════════════════════════════════════════════════════════════════
SET ROLE anon;
SELECT set_config('request.jwt.claims', '{}', false);
SELECT throws_ok(
  $$SELECT transition_workspace_subscription_status(
    'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid,
    'past_due', 'suspended', false
  )$$,
  42501,
  'anon cannot call transition_workspace_subscription_status (no EXECUTE grant)'
);
SELECT reset_role();

-- ════════════════════════════════════════════════════════════════
-- 2. authenticated CAN call transition_workspace_subscription_status
--    (SECURITY DEFINER bypasses RLS; authorization is the caller's job)
-- ════════════════════════════════════════════════════════════════
SET ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub": "11111111-1111-1111-1111-111111111111"}',
  false
);
SELECT lives_ok(
  $$SELECT transition_workspace_subscription_status(
    'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid,
    'past_due', 'suspended', false
  )$$,
  'authenticated can call transition_workspace_subscription_status (EXECUTE granted)'
);
-- Reset the row for subsequent tests
UPDATE workspaces SET subscription_status = 'past_due'
  WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
SELECT reset_role();

-- ════════════════════════════════════════════════════════════════
-- 3. service_role CAN call transition_workspace_subscription_status
-- ════════════════════════════════════════════════════════════════
SET ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role": "service_role"}', false);
SELECT lives_ok(
  $$SELECT transition_workspace_subscription_status(
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid,
    'suspended', 'deleted', false
  )$$,
  'service_role can call transition_workspace_subscription_status'
);
-- Reset
UPDATE workspaces SET subscription_status = 'suspended'
  WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
SELECT reset_role();

-- ════════════════════════════════════════════════════════════════
-- 4. PRECONDITION_FAILED when p_from_status does not match
-- ════════════════════════════════════════════════════════════════
SET ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role": "service_role"}', false);
SELECT is(
  (SELECT (transition_workspace_subscription_status(
    'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid,
    'active',  -- wrong — the row is 'past_due'
    'suspended', false
  ))->>'error'),
  'PRECONDITION_FAILED',
  'transition returns PRECONDITION_FAILED when from_status does not match'
);
SELECT reset_role();

-- ════════════════════════════════════════════════════════════════
-- 5. INVALID_STATUS for a disallowed p_to_status
-- ════════════════════════════════════════════════════════════════
SET ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role": "service_role"}', false);
SELECT is(
  (SELECT (transition_workspace_subscription_status(
    'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid,
    'past_due',
    'bogus_status', false
  ))->>'error'),
  'INVALID_STATUS',
  'transition returns INVALID_STATUS for a disallowed p_to_status'
);
SELECT reset_role();

-- ════════════════════════════════════════════════════════════════
-- 6. CHECK constraint accepts all 6 lifecycle statuses
-- ════════════════════════════════════════════════════════════════
SELECT lives_ok(
  $$INSERT INTO workspaces (id, name, slug, subscription_status) VALUES
    ('11111111-0000-0000-0000-000000000001', 'Free WS',     'pgtap-chk-free',     'free')$$,
  'CHECK accepts free'
);
SELECT lives_ok(
  $$UPDATE workspaces SET subscription_status = 'active'
    WHERE id = '11111111-0000-0000-0000-000000000001'$$,
  'CHECK accepts active'
);
SELECT lives_ok(
  $$UPDATE workspaces SET subscription_status = 'past_due'
    WHERE id = '11111111-0000-0000-0000-000000000001'$$,
  'CHECK accepts past_due'
);
SELECT lives_ok(
  $$UPDATE workspaces SET subscription_status = 'cancelled'
    WHERE id = '11111111-0000-0000-0000-000000000001'$$,
  'CHECK accepts cancelled'
);
SELECT lives_ok(
  $$UPDATE workspaces SET subscription_status = 'suspended'
    WHERE id = '11111111-0000-0000-0000-000000000001'$$,
  'CHECK accepts suspended'
);
SELECT lives_ok(
  $$UPDATE workspaces SET subscription_status = 'deleted'
    WHERE id = '11111111-0000-0000-0000-000000000001'$$,
  'CHECK accepts deleted'
);

-- ════════════════════════════════════════════════════════════════
-- 7. CHECK constraint rejects an invalid status
-- ════════════════════════════════════════════════════════════════
SELECT throws_ok(
  $$UPDATE workspaces SET subscription_status = 'expired'
    WHERE id = '11111111-0000-0000-0000-000000000001'$$,
  23514,
  'CHECK rejects invalid status (expired)'
);

-- ════════════════════════════════════════════════════════════════
-- 8. transition_to_suspended_any transitions from active/past_due/cancelled
-- ════════════════════════════════════════════════════════════════
SET ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role": "service_role"}', false);
-- The past_due workspace should transition to suspended
SELECT is(
  (SELECT (transition_to_suspended_any(
    'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid
  ))->>'success'),
  'true',
  'transition_to_suspended_any succeeds from past_due'
);
-- Calling again on the now-suspended workspace returns PRECONDITION_FAILED
SELECT is(
  (SELECT (transition_to_suspended_any(
    'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid
  ))->>'error'),
  'PRECONDITION_FAILED',
  'transition_to_suspended_any is idempotent (PRECONDITION_FAILED on re-call)'
);
SELECT reset_role();

-- ════════════════════════════════════════════════════════════════
-- 9. authenticated CANNOT call transition_to_suspended_any
--    (service_role only per review consensus)
-- ════════════════════════════════════════════════════════════════
SET ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub": "11111111-1111-1111-1111-111111111111"}',
  false
);
SELECT throws_ok(
  $$SELECT transition_to_suspended_any('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid)$$,
  42501,
  'authenticated cannot call transition_to_suspended_any (service_role only)'
);
SELECT reset_role();

-- ════════════════════════════════════════════════════════════════
-- 10. subscription_status_updated_at advances on status transition
-- ════════════════════════════════════════════════════════════════
SET ROLE service_role;
SELECT set_config('request.jwt.claims', '{"role": "service_role"}', false);
UPDATE workspaces SET subscription_status = 'past_due',
  subscription_status_updated_at = now() - interval '1 hour'
  WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
SELECT lives_ok(
  $$SELECT transition_workspace_subscription_status(
    'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid,
    'past_due', 'suspended', false
  )$$,
  'status transition succeeds'
);
SELECT ok(
  (SELECT subscription_status_updated_at > now() - interval '5 minutes'
     FROM workspaces
    WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  'subscription_status_updated_at refreshed to now() on transition'
);
SELECT reset_role();

-- Cleanup
DELETE FROM workspaces WHERE id IN (
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  '11111111-0000-0000-0000-000000000001'
);

SELECT * FROM finish();
ROLLBACK;
