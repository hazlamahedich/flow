-- Test: RLS policies for invoice_deliveries (Story 7-2)
-- Run: psql -f rls_invoice_deliveries.sql

BEGIN;

SELECT plan(8);

SET ROLE postgres;

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'pgtap-owner@test.com', '{}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'pgtap-owner@test.com', 'Owner')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspaces (id, name, slug) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test Workspace', 'pgtap-id-ws1'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Other Workspace', 'pgtap-id-ws2')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role, status) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO clients (id, workspace_id, name, email) VALUES
  ('c1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test Client', 'tc@test.com'),
  ('c2222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Other Client', 'oc@test.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO invoices (id, workspace_id, client_id, invoice_number, status, issue_date, due_date, total_cents)
  VALUES ('a1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', 'INV-2026-001', 'draft', '2026-05-01', '2026-06-01', 10000);
INSERT INTO invoices (id, workspace_id, client_id, invoice_number, status, issue_date, due_date, total_cents)
  VALUES ('a2222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'c2222222-2222-2222-2222-222222222222', 'INV-2026-002', 'draft', '2026-05-01', '2026-06-01', 5000);

-- Seed a delivery as superuser
INSERT INTO invoice_deliveries (id, invoice_id, workspace_id, status)
  VALUES ('d1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'pending');

RESET ROLE;

-- Test 1: member can SELECT invoice_deliveries
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}';
SELECT results_eq(
  'SELECT status FROM invoice_deliveries WHERE id = ''d1111111-1111-1111-1111-111111111111''',
  ARRAY['pending']::TEXT[],
  'member can select invoice_deliveries'
);
RESET ROLE;

-- Test 2: member can UPDATE invoice_deliveries
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}';
SELECT lives_ok(
  $$UPDATE invoice_deliveries SET status = 'sent', sent_at = now() WHERE id = 'd1111111-1111-1111-1111-111111111111'$$,
  'member can update invoice_deliveries'
);
RESET ROLE;

-- Test 3: non-member cannot SELECT
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "00000000-0000-0000-0000-000000000001", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}';
SELECT results_eq(
  'SELECT id FROM invoice_deliveries WHERE workspace_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  ARRAY[]::TEXT[],
  'non-member cannot select invoice_deliveries'
);
RESET ROLE;

-- Test 4: non-member cannot INSERT
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "00000000-0000-0000-0000-000000000001", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}';
SELECT throws_ok(
  $$INSERT INTO invoice_deliveries (invoice_id, workspace_id, status) VALUES ('a1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'failed')$$,
  '42501'
);
RESET ROLE;

-- Test 5: non-member cannot UPDATE
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "00000000-0000-0000-0000-000000000001", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}';
SELECT lives_ok(
  $$UPDATE invoice_deliveries SET status = 'failed' WHERE id = 'd1111111-1111-1111-1111-111111111111'$$,
  'non-member update affects 0 rows'
);
RESET ROLE;

-- Test 6: retry_count defaults to 0
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}';
SELECT results_eq(
  'SELECT retry_count::text FROM invoice_deliveries WHERE id = ''d1111111-1111-1111-1111-111111111111''',
  ARRAY['0']::TEXT[],
  'retry_count defaults to 0'
);
RESET ROLE;

-- Test 7: member can INSERT
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}';
SELECT lives_ok(
  $$INSERT INTO invoice_deliveries (invoice_id, workspace_id, status) VALUES ('a1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'pending')$$,
  'member can insert invoice_deliveries'
);
RESET ROLE;

-- Test 8: member cannot INSERT delivery for cross-workspace invoice
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}';
SELECT throws_ok(
  $$INSERT INTO invoice_deliveries (invoice_id, workspace_id, status) VALUES ('a2222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'pending')$$,
  '42501'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
