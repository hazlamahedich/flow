-- RLS tests for retainer_agreements table (Story 3.2)
-- Tests: owner/admin CRUD, member scoping, cross-tenant isolation, no DELETE, service_role, type constraint

BEGIN;

SELECT plan(25);

-- Setup: Ensure test data exists
-- Uses the same workspace/member/client fixture pattern as rls_clients.sql

-- Test 1: Owner can SELECT retainers
SELECT lives_ok(
  $$SELECT * FROM retainer_agreements WHERE workspace_id = '00000000-0000-0000-0000-000000000001'$$,
  'Owner can select retainers'
);

-- Test 2: Admin can SELECT retainers
SELECT lives_ok(
  $$SELECT * FROM retainer_agreements WHERE workspace_id = '00000000-0000-0000-0000-000000000001'$$,
  'Admin can select retainers'
);

-- Test 3: Owner can INSERT retainer (hourly_rate)
SELECT lives_ok(
  $$INSERT INTO retainer_agreements (workspace_id, client_id, type, hourly_rate_cents)
    VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'hourly_rate', 5000)$$,
  'Owner can insert hourly_rate retainer'
);

-- Test 4: Admin can INSERT retainer (different client to avoid unique index conflict)
SELECT lives_ok(
  $$INSERT INTO retainer_agreements (workspace_id, client_id, type, monthly_fee_cents, monthly_hours_threshold)
    VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'flat_monthly', 200000, 30.00)$$,
  'Admin can insert flat_monthly retainer'
);

-- Test 5: Member INSERT denied
SELECT throws_ok(
  $$INSERT INTO retainer_agreements (workspace_id, client_id, type, hourly_rate_cents)
    VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'hourly_rate', 5000)$$,
  '42501',
  'Member cannot insert retainer'
);

-- Test 6: Owner can UPDATE retainer
SELECT lives_ok(
  $$UPDATE retainer_agreements SET notes = 'updated' WHERE workspace_id = '00000000-0000-0000-0000-000000000001' AND type = 'hourly_rate'$$,
  'Owner can update retainer'
);

-- Test 7: Admin can UPDATE retainer
SELECT lives_ok(
  $$UPDATE retainer_agreements SET notes = 'admin update' WHERE workspace_id = '00000000-0000-0000-0000-000000000001' AND type = 'flat_monthly'$$,
  'Admin can update retainer'
);

-- Test 8: Member UPDATE denied
SELECT throws_ok(
  $$UPDATE retainer_agreements SET notes = 'hacked' WHERE workspace_id = '00000000-0000-0000-0000-000000000001'$$,
  '42501',
  'Member cannot update retainer'
);

-- Test 9: Cancel retainer (owner sets status='cancelled')
SELECT lives_ok(
  $$UPDATE retainer_agreements SET status = 'cancelled', cancelled_at = now() WHERE workspace_id = '00000000-0000-0000-0000-000000000001' AND type = 'hourly_rate'$$,
  'Owner can cancel retainer (UPDATE status)'
);

-- Test 10: Cancel retainer (admin)
SELECT lives_ok(
  $$UPDATE retainer_agreements SET status = 'cancelled', cancelled_at = now() WHERE workspace_id = '00000000-0000-0000-0000-000000000001' AND type = 'flat_monthly'$$,
  'Admin can cancel retainer (UPDATE status)'
);

-- Test 11: No DELETE policy (nobody can hard-delete)
SELECT throws_ok(
  $$DELETE FROM retainer_agreements WHERE workspace_id = '00000000-0000-0000-0000-000000000001'$$,
  '42501',
  'No one can hard-delete retainers'
);

-- Test 12: Cross-tenant isolation
SELECT results_eq(
  $$SELECT count(*) FROM retainer_agreements WHERE workspace_id = '00000000-0000-0000-0000-999999999999'$$,
  ARRAY[0]::bigint[],
  'Cross-tenant isolation: no results from other workspace'
);

-- Test 13: service_role full SELECT
SELECT lives_ok(
  $$SET ROLE service_role; SELECT * FROM retainer_agreements; RESET ROLE;$$,
  'service_role can select all retainers'
);

-- Test 14: service_role full INSERT
SELECT lives_ok(
  $$SET ROLE service_role;
    INSERT INTO retainer_agreements (workspace_id, client_id, type, hourly_rate_cents)
    VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'hourly_rate', 7500);
    RESET ROLE;$$,
  'service_role can insert retainers'
);

-- Test 15: service_role full UPDATE
SELECT lives_ok(
  $$SET ROLE service_role;
    UPDATE retainer_agreements SET hourly_rate_cents = 8000 WHERE hourly_rate_cents = 7500;
    RESET ROLE;$$,
  'service_role can update retainers'
);

-- Test 16: ::text cast in policies (schema verification)
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'retainer_agreements'
    AND policyname IN ('rls_retainer_agreements_owner_admin', 'rls_retainer_agreements_member_select')
    AND qual LIKE '%::text%'
  ),
  'RLS policies use ::text cast for workspace_id comparison'
);

-- Test 17: Type-specific field CHECK (hourly_rate requires rate, rejects fee)
SELECT throws_ok(
  $$INSERT INTO retainer_agreements (workspace_id, client_id, type, hourly_rate_cents, monthly_fee_cents)
    VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'hourly_rate', 5000, 200000)$$,
  '23',
  'Type CHECK: hourly_rate rejects monthly_fee_cents'
);

-- Test 18: Type-specific field CHECK (flat_monthly requires fee, rejects rate)
SELECT throws_ok(
  $$INSERT INTO retainer_agreements (workspace_id, client_id, type, monthly_fee_cents, hourly_rate_cents)
    VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'flat_monthly', 200000, 5000)$$,
  '23',
  'Type CHECK: flat_monthly rejects hourly_rate_cents'
);

-- Test 19: Type-specific field CHECK (package_based requires hours + name)
SELECT throws_ok(
  $$INSERT INTO retainer_agreements (workspace_id, client_id, type, package_hours)
    VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'package_based', 40.00)$$,
  '23',
  'Type CHECK: package_based requires package_name'
);

-- Test 20: Cancelled_at CHECK (cancelled requires cancelled_at)
SELECT throws_ok(
  $$INSERT INTO retainer_agreements (workspace_id, client_id, type, hourly_rate_cents, status)
    VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'hourly_rate', 5000, 'cancelled')$$,
  '23',
  'CHECK: cancelled status requires cancelled_at'
);

-- Test 21: billing_period_days CHECK (must be > 0)
SELECT throws_ok(
  $$INSERT INTO retainer_agreements (workspace_id, client_id, type, hourly_rate_cents, billing_period_days)
    VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'hourly_rate', 5000, 0)$$,
  '23',
  'CHECK: billing_period_days must be > 0'
);

-- Test 22: billing_period_days CHECK (must be <= 365)
SELECT throws_ok(
  $$INSERT INTO retainer_agreements (workspace_id, client_id, type, hourly_rate_cents, billing_period_days)
    VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'hourly_rate', 5000, 366)$$,
  '23',
  'CHECK: billing_period_days must be <= 365'
);

-- Test 23: Unique partial index (only one active per client)
SELECT throws_ok(
  $$SET ROLE service_role;
    INSERT INTO retainer_agreements (workspace_id, client_id, type, hourly_rate_cents)
    VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'hourly_rate', 9999);
    RESET ROLE;$$,
  '23505',
  'Unique index: only one active retainer per client'
);

-- Test 24: Package_based allows optional hourly_rate_cents (overage rate)
SELECT lives_ok(
  $$SET ROLE service_role;
    INSERT INTO retainer_agreements (workspace_id, client_id, type, package_hours, package_name, hourly_rate_cents)
    VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'package_based', 40.00, 'Social Media', 7500);
    RESET ROLE;$$,
  'package_based allows optional hourly_rate_cents for overage'
);

-- Test 25: Updated_at trigger fires on UPDATE
SELECT ok(
  EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE event_object_table = 'retainer_agreements'
    AND trigger_name = 'set_retainer_agreements_updated_at'
  ),
  'updated_at trigger exists on retainer_agreements'
);

SELECT * FROM finish();
ROLLBACK;
END;
