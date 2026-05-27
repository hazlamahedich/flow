-- pgTAP RLS tests: stripe_webhook_events table
-- Purpose: Verify workspace-scoped access, dedup handling, cross-tenant denial
-- Related: Story 7.5 — Stripe Payment Failure Handling

BEGIN;

SELECT plan(12);

-- Setup
SET ROLE postgres;

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'pgtap-owner@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', '{}'),
  ('22222222-2222-2222-2222-222222222222', 'pgtap-admin@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', '{}'),
  ('55555555-5555-5555-5555-555555555555', 'pgtap-outsider@test.com', '{"workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'pgtap-owner@test.com', 'Owner'),
  ('22222222-2222-2222-2222-222222222222', 'pgtap-admin@test.com', 'Admin'),
  ('55555555-5555-5555-5555-555555555555', 'pgtap-outsider@test.com', 'Outsider')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspaces (id, name, slug) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'WS A', 'pgtap-stripe-ws-a'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'WS B', 'pgtap-stripe-ws-b')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'admin'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '55555555-5555-5555-5555-555555555555', 'owner')
ON CONFLICT DO NOTHING;

INSERT INTO clients (id, workspace_id, name, email) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Acme', 'acme@test.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO invoices (id, workspace_id, client_id, invoice_number, status, issue_date, due_date, total_cents, amount_paid_cents, credit_balance_cents, version) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c0000000-0000-0000-0000-000000000001', 'INV-2026-001', 'sent', '2026-05-26', '2026-06-25', 10000, 0, 0, 1)
ON CONFLICT (id) DO NOTHING;

-- Insert webhook events with workspace_id set
INSERT INTO stripe_webhook_events (stripe_event_id, event_type, status, workspace_id, invoice_id, payload_json, expires_at) VALUES
  ('evt_001', 'payment_intent.payment_failed', 'processed', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a0000000-0000-0000-0000-000000000001', '{}', now() + interval '72 hours'),
  ('evt_002', 'checkout.session.expired', 'processed', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', null, '{}', now() + interval '72 hours')
ON CONFLICT (stripe_event_id) DO NOTHING;

RESET ROLE;

-- ============================================
-- Stripe Webhook Events RLS tests
-- ============================================

-- Test 1: Owner can SELECT events in own workspace
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}';
SELECT results_eq(
  'SELECT count(*)::int FROM stripe_webhook_events WHERE workspace_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  ARRAY[1::int],
  'Owner sees 1 stripe webhook event in workspace A'
);
RESET ROLE;

-- Test 2: Admin can SELECT events
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}';
SELECT results_eq(
  'SELECT count(*)::int FROM stripe_webhook_events WHERE workspace_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  ARRAY[1::int],
  'Admin sees 1 stripe webhook event in workspace A'
);
RESET ROLE;

-- Test 3: Outsider cannot see workspace A events
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "55555555-5555-5555-5555-555555555555", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}';
SELECT results_eq(
  'SELECT count(*)::int FROM stripe_webhook_events WHERE workspace_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  ARRAY[0::int],
  'Outsider sees 0 stripe webhook events from workspace A'
);
RESET ROLE;

-- Test 4: No events visible when workspace_id IS NULL (dedup row without parsed metadata)
SET ROLE postgres;
INSERT INTO stripe_webhook_events (stripe_event_id, event_type, status, workspace_id, payload_json, expires_at) VALUES
  ('evt_null_ws', 'test.event', 'pending', null, '{}', now() + interval '72 hours')
ON CONFLICT (stripe_event_id) DO NOTHING;
RESET ROLE;

SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}';
SELECT results_eq(
  'SELECT count(*)::int FROM stripe_webhook_events WHERE stripe_event_id = ''evt_null_ws''',
  ARRAY[0::int],
  'Rows with NULL workspace_id are invisible to authenticated users'
);
RESET ROLE;

-- Test 5: No INSERT allowed via authenticated role
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}';
SELECT throws_ok(
  'INSERT INTO stripe_webhook_events (stripe_event_id, event_type, status, workspace_id, payload_json, expires_at) VALUES (''evt_insert_test'', ''test.event'', ''pending'', ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', ''{}'', now() + interval ''72 hours'')',
  '42501',
  null,
  'Authenticated role cannot INSERT stripe_webhook_events'
);
RESET ROLE;

-- Test 6: Service role can INSERT (bypasses RLS)
SET ROLE postgres;
INSERT INTO stripe_webhook_events (stripe_event_id, event_type, status, workspace_id, payload_json, expires_at) VALUES
  ('evt_service_insert', 'test.event', 'pending', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '{}', now() + interval '72 hours')
ON CONFLICT (stripe_event_id) DO NOTHING;
SELECT results_eq(
  'SELECT count(*)::int FROM stripe_webhook_events WHERE stripe_event_id = ''evt_service_insert''',
  ARRAY[1::int],
  'Service role can insert stripe_webhook_events'
);
RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
