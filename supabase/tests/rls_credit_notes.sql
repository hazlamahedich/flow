-- pgTAP RLS tests: credit_notes table
-- Purpose: Verify workspace member CRUD, client-scoped member read, cross-tenant denial, append-only
-- Related: Story 7.4 — Void, Credit Note & Time Reconciliation

BEGIN;

SELECT plan(8);

-- Setup
SET ROLE postgres;

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'pgtap-owner@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', '{}'),
  ('22222222-2222-2222-2222-222222222222', 'pgtap-member@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', '{}'),
  ('33333333-3333-3333-3333-333333333333', 'pgtap-outsider@test.com', '{"workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'pgtap-owner@test.com', 'Owner'),
  ('22222222-2222-2222-2222-222222222222', 'pgtap-member@test.com', 'Member'),
  ('33333333-3333-3333-3333-333333333333', 'pgtap-outsider@test.com', 'Outsider')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspaces (id, name, slug) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'WS A', 'pgtap-credit-ws-a'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'WS B', 'pgtap-credit-ws-b')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role, status) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner', 'active'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'member', 'active'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 'owner', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO clients (id, workspace_id, name, email, status) VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Acme Corp', 'acme@test.com', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO invoices (id, workspace_id, client_id, invoice_number, status, issue_date, due_date, total_cents) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'INV-2025-001', 'sent', '2025-06-01', '2025-07-01', 10000)
ON CONFLICT (id) DO NOTHING;

INSERT INTO credit_notes (id, invoice_id, workspace_id, amount_cents, reason, created_by) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1000, 'Overcharge correction', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Tests
-- ============================================

-- 1. Owner can SELECT credit notes in their workspace
RESET ROLE;
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}';

SELECT results_eq(
  $$ SELECT id FROM credit_notes WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  ARRAY['eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid],
  'Owner can SELECT credit notes in their workspace'
);

-- 2. Member can SELECT credit notes in their workspace
SET request.jwt.claims TO '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}';

SELECT results_eq(
  $$ SELECT id FROM credit_notes WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  ARRAY['eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid],
  'Member can SELECT credit notes in their workspace'
);

-- 3. Outsider cannot SELECT credit notes in another workspace
SET request.jwt.claims TO '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}';

SELECT results_eq(
  $$ SELECT count(*)::int FROM credit_notes $$,
  ARRAY[0],
  'Outsider cannot SELECT credit notes in another workspace'
);

-- 4. Member can INSERT credit note for invoice in their workspace
SET request.jwt.claims TO '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}';

SELECT lives_ok(
  $$ INSERT INTO credit_notes (invoice_id, workspace_id, amount_cents, reason, created_by)
     VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 500, 'Small adjustment', '22222222-2222-2222-2222-222222222222') $$,
  'Member can INSERT credit note for invoice in their workspace'
);

-- 5. Outsider cannot INSERT credit note into another workspace
SET request.jwt.claims TO '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}';

SELECT throws_ok(
  $$ INSERT INTO credit_notes (invoice_id, workspace_id, amount_cents, reason, created_by)
     VALUES ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 500, 'Bad', '33333333-3333-3333-3333-333333333333') $$,
  '42501'
);

-- 6. UPDATE denied for all members (silently blocked by missing policy)
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}';
UPDATE credit_notes SET reason = 'Changed' WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
SELECT is(
  (SELECT reason FROM credit_notes WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  'Overcharge correction',
  'UPDATE denied for credit_notes (append-only)'
);

-- 7. DELETE denied for all members (silently blocked by missing policy)
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}';
DELETE FROM credit_notes WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
SELECT is(
  (SELECT count(*)::int FROM credit_notes WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'),
  1,
  'DELETE denied for credit_notes (append-only)'
);

-- 8. policy_credit_notes_select_member exists
SELECT is(
  (SELECT count(*)::int FROM pg_policies WHERE schemaname = 'public' AND tablename = 'credit_notes' AND policyname = 'policy_credit_notes_select_member'),
  1,
  'policy_credit_notes_select_member exists on credit_notes'
);

SELECT * FROM finish();
ROLLBACK;
