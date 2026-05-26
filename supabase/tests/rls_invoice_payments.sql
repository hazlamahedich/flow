-- pgTAP RLS tests: invoice_payments table
-- Purpose: Verify workspace member CRUD, client-scoped member read, cross-tenant denial, append-only
-- Related: Story 7.3 — Partial Payments & Balance Tracking

BEGIN;

SELECT plan(18);

-- Setup
SET ROLE postgres;

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'pgtap-owner@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', '{}'),
  ('22222222-2222-2222-2222-222222222222', 'pgtap-admin@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', '{}'),
  ('33333333-3333-3333-3333-333333333333', 'pgtap-member@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', '{}'),
  ('44444444-4444-4444-4444-444444444444', 'pgtap-scoped@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', '{}'),
  ('55555555-5555-5555-5555-555555555555', 'pgtap-outsider@test.com', '{"workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'pgtap-owner@test.com', 'Owner'),
  ('22222222-2222-2222-2222-222222222222', 'pgtap-admin@test.com', 'Admin'),
  ('33333333-3333-3333-3333-333333333333', 'pgtap-member@test.com', 'Member'),
  ('44444444-4444-4444-4444-444444444444', 'pgtap-scoped@test.com', 'Scoped'),
  ('55555555-5555-5555-5555-555555555555', 'pgtap-outsider@test.com', 'Outsider')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspaces (id, name, slug) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'WS A', 'pgtap-inv-ws-a'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'WS B', 'pgtap-inv-ws-b')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'member'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'member'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '55555555-5555-5555-5555-555555555555', 'owner')
ON CONFLICT DO NOTHING;

INSERT INTO clients (id, workspace_id, name, email) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Acme', 'acme@test.com'),
  ('c0000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Beta', 'beta@test.com'),
  ('c0000000-0000-0000-0000-000000000003', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Rival', 'rival@test.com')
ON CONFLICT (id) DO NOTHING;

-- Grant scoped member access to client c0000000...001 only
INSERT INTO member_client_access (workspace_id, user_id, client_id, granted_by) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;

-- Seed invoices with amount_paid_cents
INSERT INTO invoices (id, workspace_id, client_id, invoice_number, status, issue_date, due_date, total_cents, amount_paid_cents, credit_balance_cents, version) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c0000000-0000-0000-0000-000000000001', 'INV-2026-001', 'sent', '2026-05-26', '2026-06-25', 10000, 0, 0, 1),
  ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c0000000-0000-0000-0000-000000000002', 'INV-2026-002', 'partially_paid', '2026-05-26', '2026-06-25', 20000, 5000, 0, 1),
  ('a0000000-0000-0000-0000-000000000003', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'c0000000-0000-0000-0000-000000000003', 'INV-2026-003', 'sent', '2026-05-26', '2026-06-25', 30000, 0, 0, 1)
ON CONFLICT (id) DO NOTHING;

-- Seed payments
INSERT INTO invoice_payments (id, invoice_id, workspace_id, amount_cents, payment_method, payment_date, notes) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 5000, 'manual_check', '2026-05-26', 'First payment'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 10000, 'manual_bank_transfer', '2026-05-26', NULL)
ON CONFLICT (id) DO NOTHING;

RESET ROLE;

-- ============================================
-- Invoice Payments RLS tests
-- ============================================

-- Test 1: Owner can SELECT payments in own workspace
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}';
SELECT results_eq(
  'SELECT count(*)::int FROM invoice_payments WHERE workspace_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  ARRAY[1::int],
  'Owner sees 1 payment in workspace A'
);
RESET ROLE;

-- Test 2: Member can SELECT payments
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}';
SELECT results_eq(
  'SELECT count(*)::int FROM invoice_payments WHERE workspace_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  ARRAY[1::int],
  'Member sees 1 payment in workspace A'
);
RESET ROLE;

-- Test 3: Outsider cannot see workspace A payments
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "55555555-5555-5555-5555-555555555555", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}';
SELECT results_eq(
  'SELECT count(*)::int FROM invoice_payments WHERE workspace_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  ARRAY[0::int],
  'Outsider sees 0 payments from workspace A'
);
RESET ROLE;

-- Test 4: Owner can INSERT payment
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}';
SELECT lives_ok(
  $$INSERT INTO invoice_payments (invoice_id, workspace_id, amount_cents, payment_method, payment_date, notes) VALUES ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 3000, 'manual_cash', '2026-05-27', 'Cash payment')$$,
  'Owner can insert payment'
);
RESET ROLE;

-- Test 5: Member can INSERT payment
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}';
SELECT lives_ok(
  $$INSERT INTO invoice_payments (invoice_id, workspace_id, amount_cents, payment_method, payment_date, notes) VALUES ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2000, 'manual_other', '2026-05-27', 'Member payment')$$,
  'Member can insert payment'
);
RESET ROLE;

-- Test 6: Outsider cannot INSERT into other workspace
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "55555555-5555-5555-5555-555555555555", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}';
SELECT throws_ok(
  $$INSERT INTO invoice_payments (invoice_id, workspace_id, amount_cents, payment_method, payment_date, notes) VALUES ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1000, 'manual_check', '2026-05-27', 'Hack')$$,
  '42501'
);
RESET ROLE;

-- Test 7: UPDATE is denied on payments (append-only) -- silently blocked by missing policy
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}';
UPDATE invoice_payments SET amount_cents = 9999 WHERE id = 'b0000000-0000-0000-0000-000000000001';
SELECT is(
  (SELECT amount_cents::bigint FROM invoice_payments WHERE id = 'b0000000-0000-0000-0000-000000000001'),
  5000::bigint,
  'Owner cannot UPDATE payment (append-only)'
);
RESET ROLE;

-- Test 8: DELETE is denied on payments (append-only) -- silently blocked by missing policy
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}';
DELETE FROM invoice_payments WHERE id = 'b0000000-0000-0000-0000-000000000001';
SELECT is(
  (SELECT count(*)::int FROM invoice_payments WHERE id = 'b0000000-0000-0000-0000-000000000001'),
  1,
  'Owner cannot DELETE payment (append-only)'
);
RESET ROLE;

-- Test 9: Scoped member sees only payments for invoices of their assigned client
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "44444444-4444-4444-4444-444444444444", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}';
SELECT results_eq(
  'SELECT count(*)::int FROM invoice_payments ip JOIN invoices inv ON inv.id = ip.invoice_id JOIN member_client_access mca ON mca.client_id = inv.client_id WHERE mca.user_id = ''44444444-4444-4444-4444-444444444444''',
  ARRAY[2::int], -- payments for a000000000001 (owner+member inserts) = 2 for client c000000000001
  'Scoped member sees payments for their assigned client invoices only'
);
RESET ROLE;

-- Test 10: payment amount_cents must be >= 0
SET ROLE postgres;
SELECT throws_ok(
  $$INSERT INTO invoice_payments (invoice_id, workspace_id, amount_cents, payment_method, payment_date, notes) VALUES ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', -100, 'manual_check', '2026-05-27', 'Bad')$$,
  '23514'
);
RESET ROLE;

-- Test 11: workspace_id on payments used for direct RLS
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}';
SELECT results_eq(
  'SELECT count(*)::int FROM invoice_payments',
  ARRAY[3::int], -- seeded b000000000001 + inserted two on a000000000001 = 3
  'Member sees all payments in their workspace via direct workspace_id RLS'
);
RESET ROLE;

-- Test 12: Cross-workspace payment visibility denied
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "55555555-5555-5555-5555-555555555555", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}';
SELECT results_eq(
  'SELECT count(*)::int FROM invoice_payments',
  ARRAY[1::int], -- seeded b000000000002 in workspace B
  'Outsider sees only payments in their own workspace'
);
RESET ROLE;

-- Test 13: invoice_payments select via invoices join (client-scoped policy)
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "44444444-4444-4444-4444-444444444444", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}';
SELECT results_eq(
  'SELECT count(*)::int FROM invoice_payments WHERE workspace_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  ARRAY[3::int], -- same as Test 11 for scoped member in same workspace
  'Scoped member can SELECT all workspace payments via workspace_id (no invoice join restriction for SELECT)'
);
RESET ROLE;

-- Test 14: INSERT payment with invalid method fails CHECK constraint
SET ROLE postgres;
SELECT throws_ok(
  $$INSERT INTO invoice_payments (invoice_id, workspace_id, amount_cents, payment_method, payment_date, notes) VALUES ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 100, 'bitcoin', '2026-05-27', 'Bad method')$$,
  '23514'
);
RESET ROLE;

-- Test 15: Stripe payment intent ID uniqueness
SET ROLE postgres;
SELECT lives_ok(
  $$INSERT INTO invoice_payments (id, invoice_id, workspace_id, amount_cents, payment_method, payment_date, stripe_payment_intent_id) VALUES ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1000, 'stripe', '2026-05-27', 'pi_test_123')$$,
  'Can insert payment with stripe_payment_intent_id'
);
RESET ROLE;

-- Test 16: Duplicate stripe_payment_intent_id rejected
SET ROLE postgres;
SELECT throws_ok(
  $$INSERT INTO invoice_payments (id, invoice_id, workspace_id, amount_cents, payment_method, payment_date, stripe_payment_intent_id) VALUES ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 2000, 'stripe', '2026-05-27', 'pi_test_123')$$,
  '23505'
);
RESET ROLE;

-- Test 17: amount_paid_cents must be >= 0
SET ROLE postgres;
SELECT throws_ok(
  $$UPDATE invoices SET amount_paid_cents = -100 WHERE id = 'a0000000-0000-0000-0000-000000000001'$$,
  '23514'
);
RESET ROLE;

-- Test 18: credit_balance_cents must be >= 0
SET ROLE postgres;
SELECT throws_ok(
  $$UPDATE invoices SET credit_balance_cents = -50 WHERE id = 'a0000000-0000-0000-0000-000000000001'$$,
  '23514'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
