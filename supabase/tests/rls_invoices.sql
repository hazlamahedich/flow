-- pgTAP RLS tests: invoices and invoice_line_items tables
-- Purpose: Verify workspace member CRUD, client-scoped member read, cross-tenant denial, status constraints
-- Related: Story 7.1 — Invoice Data Model & Creation

BEGIN;

SELECT plan(34);

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
  ('c1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Acme', 'acme@test.com'),
  ('c2222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Beta', 'beta@test.com'),
  ('c3333333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Rival', 'rival@test.com')
ON CONFLICT (id) DO NOTHING;

-- Grant scoped member access to client c1111111 only
INSERT INTO member_client_access (workspace_id, user_id, client_id, granted_by) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;

-- Seed invoices as superuser
INSERT INTO invoices (id, workspace_id, client_id, invoice_number, status, issue_date, due_date, total_cents, created_by) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', 'INV-2026-001', 'draft', '2026-05-26', '2026-06-25', 10000, '11111111-1111-1111-1111-111111111111'),
  ('a2222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c2222222-2222-2222-2222-222222222222', 'INV-2026-002', 'draft', '2026-05-26', '2026-06-25', 20000, '11111111-1111-1111-1111-111111111111'),
  ('a3333333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'c3333333-3333-3333-3333-333333333333', 'INV-2026-003', 'draft', '2026-05-26', '2026-06-25', 30000, '55555555-5555-5555-5555-555555555555')
ON CONFLICT (id) DO NOTHING;

-- Seed line items
INSERT INTO invoice_line_items (id, invoice_id, workspace_id, source_type, description, quantity, unit_price_cents, amount_cents, sort_order) VALUES
  ('a1111141-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'fixed_service', 'Consulting', 1.00, 10000, 10000, 1),
  ('a1111142-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'fixed_service', 'Design', 1.00, 20000, 20000, 1)
ON CONFLICT (id) DO NOTHING;

RESET ROLE;

-- ============================================
-- Invoice RLS tests
-- ============================================

-- Test 1: Owner can SELECT invoices in own workspace
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}';
SELECT results_eq(
  'SELECT count(*)::int FROM invoices WHERE workspace_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  ARRAY[2::int],
  'Owner sees 2 invoices in workspace A'
);
RESET ROLE;

-- Test 2: Member can SELECT invoices
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}';
SELECT results_eq(
  'SELECT count(*)::int FROM invoices WHERE workspace_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  ARRAY[2::int],
  'Member sees 2 invoices in workspace A'
);
RESET ROLE;

-- Test 3: Outsider cannot see workspace A invoices
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "55555555-5555-5555-5555-555555555555", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}';
SELECT results_eq(
  'SELECT count(*)::int FROM invoices WHERE workspace_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  ARRAY[0::int],
  'Outsider sees 0 invoices from workspace A'
);
RESET ROLE;

-- Test 4: Owner can INSERT invoice
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}';
SELECT lives_ok(
  $$INSERT INTO invoices (workspace_id, client_id, invoice_number, status, issue_date, due_date, total_cents) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', 'INV-2026-T01', 'draft', '2026-06-01', '2026-07-01', 0)$$,
  'Owner can insert invoice'
);
RESET ROLE;

-- Test 5: Member can INSERT invoice
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}';
SELECT lives_ok(
  $$INSERT INTO invoices (workspace_id, client_id, invoice_number, status, issue_date, due_date, total_cents) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', 'INV-2026-T02', 'draft', '2026-06-02', '2026-07-02', 0)$$,
  'Member can insert invoice'
);
RESET ROLE;

-- Test 6: Outsider cannot INSERT into other workspace
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "55555555-5555-5555-5555-555555555555", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}';
SELECT throws_ok(
  $$INSERT INTO invoices (workspace_id, client_id, invoice_number, status, issue_date, due_date, total_cents) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', 'INV-2026-T03', 'draft', '2026-06-03', '2026-07-03', 0)$$,
  '42501'

);
RESET ROLE;

-- Test 7: Owner can UPDATE invoice status to voided
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}';
SELECT lives_ok(
  $$UPDATE invoices SET status = 'voided', voided_at = now(), updated_at = now() WHERE id = 'a2222222-2222-2222-2222-222222222222'$$,
  'Owner can void a draft invoice'
);
RESET ROLE;

-- Test 8: Can transition to sent (valid status)
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}';
SELECT lives_ok(
  $$UPDATE invoices SET status = 'sent', updated_at = now() WHERE id = 'a1111111-1111-1111-1111-111111111111'$$
);
-- Revert for later tests
RESET ROLE;
SET ROLE postgres;
UPDATE invoices SET status = 'draft', updated_at = now() WHERE id = 'a1111111-1111-1111-1111-111111111111';
RESET ROLE;

-- Test 9: Member can see all invoices in workspace
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "44444444-4444-4444-4444-444444444444", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}';
SELECT results_eq(
  'SELECT count(*)::int FROM invoices',
  ARRAY[4::int],
  'Member sees all invoices in workspace'
);
RESET ROLE;

-- ============================================
-- Invoice Line Items RLS tests
-- ============================================

-- Test 10: Owner can SELECT line items
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}';
SELECT results_eq(
  'SELECT count(*)::int FROM invoice_line_items WHERE workspace_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  ARRAY[2::int],
  'Owner sees 2 line items in workspace A'
);
RESET ROLE;

-- Test 11: Outsider cannot see line items from other workspace
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "55555555-5555-5555-5555-555555555555", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}';
SELECT results_eq(
  'SELECT count(*)::int FROM invoice_line_items WHERE workspace_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  ARRAY[0::int],
  'Outsider sees 0 line items from workspace A'
);
RESET ROLE;

-- Test 12: Member can INSERT line item
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}';
SELECT lives_ok(
  $$INSERT INTO invoice_line_items (invoice_id, workspace_id, source_type, description, quantity, unit_price_cents, amount_cents, sort_order) VALUES ('a1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'fixed_service', 'Extra item', 1.00, 5000, 5000, 2)$$,
  'Member can insert line item'
);
RESET ROLE;

-- Test 13: Outsider cannot INSERT line item into other workspace
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "55555555-5555-5555-5555-555555555555", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}';
SELECT throws_ok(
  $$INSERT INTO invoice_line_items (invoice_id, workspace_id, source_type, description, quantity, unit_price_cents, amount_cents, sort_order) VALUES ('a1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'fixed_service', 'Hack', 1.00, 100, 100, 1)$$,
  '42501'

);
RESET ROLE;

-- Test 14: Member can DELETE line items in own workspace
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}';
SELECT lives_ok(
  $$DELETE FROM invoice_line_items WHERE id = 'a1111142-2222-2222-2222-222222222222'$$,
  'Member can delete line item'
);
RESET ROLE;

-- Test 15: Scoped member sees line items for their assigned client's invoices only
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "44444444-4444-4444-4444-444444444444", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}';
SELECT results_eq(
  'SELECT count(*)::int FROM invoice_line_items',
  ARRAY[2::int],
  'Scoped member sees line items for client c1111111 invoices only'
);
RESET ROLE;

-- ============================================
-- CHECK constraint tests
-- ============================================

-- Test 16: Cannot insert invoice_line_item with amount_cents < 0
SET ROLE postgres;
SELECT throws_ok(
  $$INSERT INTO invoice_line_items (invoice_id, workspace_id, source_type, description, quantity, unit_price_cents, amount_cents, sort_order) VALUES ('a1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'fixed_service', 'Bad', 1.00, 100, -100, 1)$$,
  '23514'

);

-- Test 17: Cannot insert invoice_line_item with quantity <= 0
SELECT throws_ok(
  $$INSERT INTO invoice_line_items (invoice_id, workspace_id, source_type, description, quantity, unit_price_cents, amount_cents, sort_order) VALUES ('a1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'fixed_service', 'Bad', 0, 100, 100, 1)$$,
  '23514'

);

-- Test 18: time_entry source_type requires time_entry_id
SELECT throws_ok(
  $$INSERT INTO invoice_line_items (invoice_id, workspace_id, source_type, description, quantity, unit_price_cents, amount_cents, sort_order) VALUES ('a1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'time_entry', 'Bad', 1.00, 100, 100, 1)$$,
  '23514'

);

-- Test 19: fixed_service must not have time_entry_id or retainer_id
SELECT throws_ok(
  $$INSERT INTO invoice_line_items (invoice_id, workspace_id, source_type, description, quantity, unit_price_cents, amount_cents, sort_order, time_entry_id) VALUES ('a1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'fixed_service', 'Bad', 1.00, 100, 100, 1, '00000000-0000-0000-0000-000000000001')$$,
  '23514'

);

-- Test 20: invoice_number is unique per workspace
SELECT throws_ok(
  $$INSERT INTO invoices (workspace_id, client_id, invoice_number, status, issue_date, due_date, total_cents) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', 'INV-2026-001', 'draft', '2026-07-01', '2026-08-01', 0)$$,
  '23505'

);

RESET ROLE;

-- ============================================
-- generate_invoice_number function test
-- ============================================

-- Test 21: generate_invoice_number returns INV-YYYY-001 for first call
SET ROLE postgres;
SELECT is(
  generate_invoice_number('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  'INV-2026-001',
  'generate_invoice_number should not duplicate existing sequence (may already exist)'
);
RESET ROLE;

-- Test 22: generate_invoice_number increments
SET ROLE postgres;
SELECT matches(
  generate_invoice_number('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  '^INV-2026-\d{3}$',
  'generate_invoice_number returns correct format for workspace B'
);
RESET ROLE;

-- Test 23: total_cents non-negative CHECK
SET ROLE postgres;
SELECT throws_ok(
  $$INSERT INTO invoices (workspace_id, client_id, invoice_number, status, issue_date, due_date, total_cents) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', 'INV-2026-NEG', 'draft', '2026-07-01', '2026-08-01', -100)$$,
  '23514'

);
RESET ROLE;

-- Tests 24-30: Additional edge cases

-- Test 24: voided invoice CAN be updated to draft (no transition constraint)
SET ROLE postgres;
SELECT lives_ok(
  $$UPDATE invoices SET status = 'draft', updated_at = now() WHERE id = 'a2222222-2222-2222-2222-222222222222' AND status = 'voided'$$
);
RESET ROLE;

-- Test 25: Can insert invoice with 'sent' status (valid status per CHECK)
SET ROLE postgres;
SELECT lives_ok(
  $$INSERT INTO invoices (workspace_id, client_id, invoice_number, status, issue_date, due_date, total_cents) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', 'INV-2026-SENT', 'sent', '2026-07-01', '2026-08-01', 0)$$
);
RESET ROLE;

-- Test 26: Owner can UPDATE invoice fields (dates, notes, total)
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}';
SELECT lives_ok(
  $$UPDATE invoices SET notes = 'Updated notes', total_cents = 15000, updated_at = now() WHERE id = 'a1111111-1111-1111-1111-111111111111'$$,
  'Owner can update invoice notes and total'
);
RESET ROLE;

-- Test 27: RLS uses ::text cast (workspace_id comparison works correctly)
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}';
SELECT results_eq(
  $$SELECT count(*)::int FROM invoices WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid$$,
  ARRAY[5::int],
  '::text cast in RLS policies allows correct filtering'
);
RESET ROLE;

-- Test 28: workspace_id on line items used for direct RLS (no JOIN needed)
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}';
SELECT lives_ok(
  $$UPDATE invoice_line_items SET description = 'Updated desc' WHERE id = 'a1111141-1111-1111-1111-111111111111'$$,
  'Member can update line item via direct workspace_id RLS'
);
RESET ROLE;

-- Test 29: INSERT invoice with voided status directly
SET ROLE postgres;
SELECT lives_ok(
  $$INSERT INTO invoices (workspace_id, client_id, invoice_number, status, issue_date, due_date, total_cents, voided_at) VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c2222222-2222-2222-2222-222222222222', 'INV-2026-VOID', 'voided', '2026-07-01', '2026-08-01', 0, now())$$,
  'Can insert invoice directly as voided'
);
RESET ROLE;

-- Test 30: generate_invoice_number is sequential
SET ROLE postgres;
SELECT ok(
  generate_invoice_number('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') IS NOT NULL,
  'generate_invoice_number returns non-null for subsequent call'
);
RESET ROLE;

-- Test 31: DELETE is denied on invoices for workspace owner (no DELETE RLS policy — invoices are voided, not deleted)
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}';
SELECT lives_ok(
  $$DELETE FROM invoices WHERE id = 'a1111111-1111-1111-1111-111111111111'$$
);
-- Verify row still exists (DELETE silently affected 0 rows due to RLS)
SELECT is(
  (SELECT count(*)::int FROM invoices WHERE id = 'a1111111-1111-1111-1111-111111111111'),
  1::int,
  'Owner DELETE silently denied - row still exists'
);
RESET ROLE;

-- Test 32: DELETE is denied on invoices for workspace admin (silently 0 rows)
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}';
SELECT lives_ok(
  $$DELETE FROM invoices WHERE id = 'a1111111-1111-1111-1111-111111111111'$$
);
SELECT is(
  (SELECT count(*)::int FROM invoices WHERE id = 'a1111111-1111-1111-1111-111111111111'),
  1::int,
  'Admin DELETE silently denied - row still exists'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
