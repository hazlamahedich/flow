-- pgTAP RLS tests: invoice_payment_attempts table
-- Purpose: Verify workspace member CRUD, cross-tenant denial, append-only
-- Related: Story 7.5 — Stripe Payment Failure Handling

BEGIN;

SELECT plan(14);

-- Setup
SET ROLE postgres;

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'pgtap-owner@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', '{}'),
  ('22222222-2222-2222-2222-222222222222', 'pgtap-admin@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', '{}'),
  ('33333333-3333-3333-3333-333333333333', 'pgtap-member@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', '{}'),
  ('55555555-5555-5555-5555-555555555555', 'pgtap-outsider@test.com', '{"workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'pgtap-owner@test.com', 'Owner'),
  ('22222222-2222-2222-2222-222222222222', 'pgtap-admin@test.com', 'Admin'),
  ('33333333-3333-3333-3333-333333333333', 'pgtap-member@test.com', 'Member'),
  ('55555555-5555-5555-5555-555555555555', 'pgtap-outsider@test.com', 'Outsider')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspaces (id, name, slug) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'WS A', 'pgtap-attempts-ws-a'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'WS B', 'pgtap-attempts-ws-b')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'admin'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'member'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '55555555-5555-5555-5555-555555555555', 'owner')
ON CONFLICT DO NOTHING;

INSERT INTO clients (id, workspace_id, name, email) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Acme', 'acme@test.com'),
  ('c0000000-0000-0000-0000-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Rival', 'rival@test.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO invoices (id, workspace_id, client_id, invoice_number, status, issue_date, due_date, total_cents, amount_paid_cents, credit_balance_cents, version) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c0000000-0000-0000-0000-000000000001', 'INV-2026-001', 'sent', '2026-05-26', '2026-06-25', 10000, 0, 0, 1),
  ('a0000000-0000-0000-0000-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'c0000000-0000-0000-0000-000000000002', 'INV-2026-002', 'sent', '2026-05-26', '2026-06-25', 20000, 0, 0, 1)
ON CONFLICT (id) DO NOTHING;

-- Seed payment attempts
INSERT INTO invoice_payment_attempts (id, invoice_id, workspace_id, stripe_event_id, attempt_type, status, error_code, error_message, amount_cents) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'evt_001', 'stripe_checkout', 'failed', 'card_declined', 'Card was declined', 10000),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'evt_002', 'stripe_checkout', 'failed', 'insufficient_funds', 'Insufficient funds', 20000)
ON CONFLICT (id) DO NOTHING;

RESET ROLE;

-- ============================================
-- Invoice Payment Attempts RLS tests
-- ============================================

-- Test 1: Owner can SELECT attempts in own workspace
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}';
SELECT results_eq(
  'SELECT count(*)::int FROM invoice_payment_attempts WHERE workspace_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  ARRAY[1::int],
  'Owner sees 1 payment attempt in workspace A'
);
RESET ROLE;

-- Test 2: Admin can SELECT attempts
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}';
SELECT results_eq(
  'SELECT count(*)::int FROM invoice_payment_attempts WHERE workspace_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  ARRAY[1::int],
  'Admin sees 1 payment attempt in workspace A'
);
RESET ROLE;

-- Test 3: Member can SELECT attempts
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}';
SELECT results_eq(
  'SELECT count(*)::int FROM invoice_payment_attempts WHERE workspace_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  ARRAY[1::int],
  'Member sees 1 payment attempt in workspace A'
);
RESET ROLE;

-- Test 4: Outsider cannot see workspace A attempts
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "55555555-5555-5555-5555-555555555555", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}';
SELECT results_eq(
  'SELECT count(*)::int FROM invoice_payment_attempts WHERE workspace_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  ARRAY[0::int],
  'Outsider sees 0 payment attempts from workspace A'
);
RESET ROLE;

-- Test 5: Authenticated role can INSERT
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}';
SELECT lives_ok(
  'INSERT INTO invoice_payment_attempts (invoice_id, workspace_id, stripe_event_id, attempt_type, status, error_code, error_message, amount_cents) VALUES (''a0000000-0000-0000-0000-000000000001'', ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'', ''evt_insert_test'', ''stripe_checkout'', ''failed'', ''expired_card'', ''Card expired'', 5000)',
  'Owner can insert payment attempt into workspace A'
);
RESET ROLE;

-- Test 6: No UPDATE allowed — append-only
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}';
SELECT throws_ok(
  'UPDATE invoice_payment_attempts SET status = ''succeeded'' WHERE id = ''b0000000-0000-0000-0000-000000000001''',
  '42501',
  null,
  'Cannot UPDATE invoice_payment_attempts — append-only'
);
RESET ROLE;

-- Test 7: No DELETE allowed — append-only
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}';
SELECT throws_ok(
  'DELETE FROM invoice_payment_attempts WHERE id = ''b0000000-0000-0000-0000-000000000001''',
  '42501',
  null,
  'Cannot DELETE invoice_payment_attempts — append-only'
);
RESET ROLE;

SELECT * FROM finish();

ROLLBACK;
