-- pgTAP tests for Story 9.3a — Stripe Webhook Infrastructure
-- Covers: workspace subscription columns, invoice dedup_hash, app_config seed,
--          upsert_workspace_subscription / set_workspace_subscription_status RPCs.
--
-- Run via: PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
--          -f supabase/tests/epic-9/9-3a-stripe-webhook-infrastructure.sql

BEGIN;

SELECT plan(23);

-- ───────────────────────────────────────────────────────────────
-- Setup
-- ───────────────────────────────────────────────────────────────

DELETE FROM invoices WHERE workspace_id IN (
  SELECT id FROM workspaces WHERE slug LIKE 'rls_93a\_%' ESCAPE '\'
);
DELETE FROM clients WHERE workspace_id IN (
  SELECT id FROM workspaces WHERE slug LIKE 'rls_93a\_%' ESCAPE '\'
);
DELETE FROM workspaces WHERE slug LIKE 'rls_93a\_%' ESCAPE '\';

INSERT INTO workspaces (name, slug)
VALUES ('9-3a Test Workspace', 'rls_93a_test');

-- ───────────────────────────────────────────────────────────────
-- Workspace schema
-- ───────────────────────────────────────────────────────────────

SELECT has_column('public', 'workspaces', 'subscription_status',
  'workspaces.subscription_status column exists');
SELECT has_column('public', 'workspaces', 'subscription_tier',
  'workspaces.subscription_tier column exists');
SELECT has_column('public', 'workspaces', 'stripe_customer_id',
  'workspaces.stripe_customer_id column exists');
SELECT has_column('public', 'workspaces', 'stripe_subscription_id',
  'workspaces.stripe_subscription_id column exists');
SELECT has_column('public', 'workspaces', 'subscription_current_period_start',
  'workspaces.subscription_current_period_start column exists');
SELECT has_column('public', 'workspaces', 'subscription_current_period_end',
  'workspaces.subscription_current_period_end column exists');
SELECT has_column('public', 'workspaces', 'subscription_cancel_at_period_end',
  'workspaces.subscription_cancel_at_period_end column exists');
SELECT has_column('public', 'workspaces', 'subscription_updated_at',
  'workspaces.subscription_updated_at column exists');

SELECT col_default_is('public', 'workspaces', 'subscription_status', 'free',
  'subscription_status defaults to free');
SELECT col_default_is('public', 'workspaces', 'subscription_tier', 'free',
  'subscription_tier defaults to free');

-- ───────────────────────────────────────────────────────────────
-- Invoice dedup_hash
-- ───────────────────────────────────────────────────────────────

SELECT has_column('public', 'invoices', 'dedup_hash',
  'invoices.dedup_hash column exists');

SELECT index_is_unique('public', 'invoices', 'idx_invoices_dedup_hash',
  'dedup_hash unique partial index exists');

-- ───────────────────────────────────────────────────────────────
-- app_config tier seed keys exist (values intentionally placeholder)
-- ───────────────────────────────────────────────────────────────

SELECT results_eq(
  'SELECT key FROM app_config WHERE key IN (''tier_limits'', ''stripe_prices'', ''subscription_grace_period_days'', ''subscription_suspension_period_days'', ''stripe_free_transaction_fee_percent'') ORDER BY key',
  ARRAY['stripe_free_transaction_fee_percent', 'stripe_prices', 'subscription_grace_period_days', 'subscription_suspension_period_days', 'tier_limits'],
  'app_config tier-related seed keys are present'
);

-- ───────────────────────────────────────────────────────────────
-- RPC: upsert_workspace_subscription
-- ───────────────────────────────────────────────────────────────

SELECT has_function('public', 'upsert_workspace_subscription',
  ARRAY['uuid', 'text', 'text', 'text', 'text', 'timestamp with time zone', 'timestamp with time zone', 'boolean'],
  'upsert_workspace_subscription RPC exists');

SELECT results_eq(
  'SELECT upsert_workspace_subscription(
    (SELECT id FROM workspaces WHERE slug = ''rls_93a_test''),
    ''cus_123'', ''sub_123'', ''pro'', ''active'',
    ''2026-06-18T00:00:00Z''::timestamptz,
    ''2026-07-18T00:00:00Z''::timestamptz,
    false
  )',
  ARRAY['{"success": true}'::jsonb],
  'upsert_workspace_subscription returns success for valid workspace'
);

SELECT results_eq(
  'SELECT upsert_workspace_subscription(
    gen_random_uuid(), ''cus_456'', ''sub_456'', ''agency'', ''active'',
    ''2026-06-18T00:00:00Z''::timestamptz,
    ''2026-07-18T00:00:00Z''::timestamptz,
    false
  )',
  ARRAY['{"error": "WORKSPACE_NOT_FOUND"}'::jsonb],
  'upsert_workspace_subscription returns WORKSPACE_NOT_FOUND for missing workspace'
);

-- Status and tier persisted correctly
SELECT results_eq(
  'SELECT subscription_status, subscription_tier, stripe_customer_id, stripe_subscription_id
     FROM workspaces
    WHERE slug = ''rls_93a_test''',
  $$VALUES ('active', 'pro', 'cus_123', 'sub_123')$$,
  'workspace subscription fields updated after upsert'
);

-- Out-of-order delivery guard: older period_end should not overwrite dates
SELECT results_eq(
  'SELECT upsert_workspace_subscription(
    (SELECT id FROM workspaces WHERE slug = ''rls_93a_test''),
    ''cus_123'', ''sub_123'', ''pro'', ''active'',
    ''2026-06-10T00:00:00Z''::timestamptz,
    ''2026-07-10T00:00:00Z''::timestamptz,
    false
  )',
  ARRAY['{"success": true}'::jsonb],
  'older period_end upsert still returns success'
);

SELECT results_eq(
  'SELECT subscription_current_period_end::text
     FROM workspaces
    WHERE slug = ''rls_93a_test''',
  ARRAY['2026-07-18 00:00:00+00'],
  'older period_end did not overwrite existing period dates'
);

-- ───────────────────────────────────────────────────────────────
-- RPC: set_workspace_subscription_status
-- ───────────────────────────────────────────────────────────────

SELECT has_function('public', 'set_workspace_subscription_status',
  ARRAY['uuid', 'text', 'timestamp with time zone', 'boolean'],
  'set_workspace_subscription_status RPC exists');

SELECT results_eq(
  'SELECT set_workspace_subscription_status(
    (SELECT id FROM workspaces WHERE slug = ''rls_93a_test''),
    ''past_due'',
    ''2026-07-25T00:00:00Z''::timestamptz,
    false
  )',
  ARRAY['{"success": true}'::jsonb],
  'set_workspace_subscription_status sets past_due and updates period_end'
);

SELECT results_eq(
  'SELECT subscription_status
     FROM workspaces
    WHERE slug = ''rls_93a_test''',
  ARRAY['past_due'],
  'workspace status set to past_due'
);

SELECT results_eq(
  'SELECT set_workspace_subscription_status(gen_random_uuid(), ''cancelled'', NULL, false)',
  ARRAY['{"error": "WORKSPACE_NOT_FOUND"}'::jsonb],
  'set_workspace_subscription_status returns WORKSPACE_NOT_FOUND for missing workspace'
);

-- ───────────────────────────────────────────────────────────────
-- Cleanup
-- ───────────────────────────────────────────────────────────────

DELETE FROM workspaces WHERE slug = 'rls_93a_test';

SELECT * FROM finish();

ROLLBACK;
