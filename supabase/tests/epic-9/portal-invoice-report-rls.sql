-- pgTAP RLS tests for portal invoice/report cross-table RLS + SECURITY DEFINER RPCs
-- Story 9.2: Client Portal Invoice Payment & Report Approval (FR51, FR52, FR53, FR54)
--
-- Run via: PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
--          -f supabase/tests/epic-9/portal-invoice-report-rls.sql

BEGIN;

SELECT plan(38);

-- ───────────────────────────────────────────────────────────────
-- Setup: Create test workspace, users, clients, invoices, reports
-- ───────────────────────────────────────────────────────────────

DELETE FROM portal_tokens WHERE workspace_id IN (
  SELECT id FROM workspaces WHERE slug LIKE 'rls_p921\_%' ESCAPE '\'
);
DELETE FROM client_notification_logs WHERE workspace_id IN (
  SELECT id FROM workspaces WHERE slug LIKE 'rls_p921\_%' ESCAPE '\'
);
DELETE FROM invoice_payments WHERE workspace_id IN (
  SELECT id FROM workspaces WHERE slug LIKE 'rls_p921\_%' ESCAPE '\'
);
DELETE FROM invoice_line_items WHERE workspace_id IN (
  SELECT id FROM workspaces WHERE slug LIKE 'rls_p921\_%' ESCAPE '\'
);
DELETE FROM weekly_report_sections WHERE report_id IN (
  SELECT id FROM weekly_reports WHERE workspace_id IN (
    SELECT id FROM workspaces WHERE slug LIKE 'rls_p921\_%' ESCAPE '\'
  )
);
DELETE FROM weekly_reports WHERE workspace_id IN (
  SELECT id FROM workspaces WHERE slug LIKE 'rls_p921\_%' ESCAPE '\'
);
DELETE FROM invoices WHERE workspace_id IN (
  SELECT id FROM workspaces WHERE slug LIKE 'rls_p921\_%' ESCAPE '\'
);
DELETE FROM clients WHERE workspace_id IN (
  SELECT id FROM workspaces WHERE slug LIKE 'rls_p921\_%' ESCAPE '\'
);
DELETE FROM workspaces WHERE slug LIKE 'rls_p921\_%' ESCAPE '\';
DELETE FROM auth.users WHERE id = '55555555-5555-5555-5555-555555550001';

-- Test user + workspace
INSERT INTO auth.users (id, email, instance_id, created_at)
VALUES
  ('55555555-5555-5555-5555-555555550001', 'rls-p921-owner@test.com', '00000000-0000-0000-0000-000000000000', now());

INSERT INTO users (id, email, name, created_at)
VALUES
  ('55555555-5555-5555-5555-555555550001', 'rls-p921-owner@test.com', 'RLS P921 Owner', now());

INSERT INTO workspaces (id, name, slug, created_by, created_at)
VALUES
  ('88888888-8888-8888-8888-888888880001', 'rls_p921_ws', 'rls-p921-ws', '55555555-5555-5555-5555-555555550001', now());

-- Test clients
INSERT INTO clients (id, workspace_id, name, status, email, archived_at, created_at)
VALUES
  ('99999999-9999-9999-9999-999999990001', '88888888-8888-8888-8888-888888880001', 'P921 Client A', 'active', 'p921a@test.com', null, now()),
  ('99999999-9999-9999-9999-999999990002', '88888888-8888-8888-8888-888888880001', 'P921 Client B', 'active', 'p921b@test.com', null, now()),
  ('99999999-9999-9999-9999-999999990003', '88888888-8888-8888-8888-888888880001', 'P921 Client C', 'archived', 'p921c@test.com', now(), now());

-- Test invoices
INSERT INTO invoices (id, workspace_id, client_id, invoice_number, status, issue_date, due_date, total_cents, currency, created_at)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001', '88888888-8888-8888-8888-888888880001', '99999999-9999-9999-9999-999999990001', 'P921-001', 'sent', '2026-06-01', '2026-06-30', 10000, 'usd', now()),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002', '88888888-8888-8888-8888-888888880001', '99999999-9999-9999-9999-999999990001', 'P921-002', 'draft', '2026-06-01', '2026-06-30', 5000, 'usd', now()),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003', '88888888-8888-8888-8888-888888880001', '99999999-9999-9999-9999-999999990003', 'P921-003', 'sent', '2026-06-01', '2026-06-30', 3000, 'usd', now());

INSERT INTO invoice_line_items (id, invoice_id, workspace_id, source_type, description, quantity, unit_price_cents, amount_cents, sort_order, created_at)
VALUES
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001', '88888888-8888-8888-8888-888888880001', 'fixed_service', 'P921 Service', 1, 10000, 10000, 0, now());

INSERT INTO weekly_reports (id, workspace_id, client_id, period_start, period_end, status, generated_by, generated_at, created_at, updated_at)
VALUES
  ('cccccccc-cccc-cccc-cccc-ccccccccc001', '88888888-8888-8888-8888-888888880001', '99999999-9999-9999-9999-999999990001', '2026-06-01', '2026-06-07', 'sent', '55555555-5555-5555-5555-555555550001', now(), now(), now()),
  ('cccccccc-cccc-cccc-cccc-ccccccccc002', '88888888-8888-8888-8888-888888880001', '99999999-9999-9999-9999-999999990003', '2026-06-01', '2026-06-07', 'sent', '55555555-5555-5555-5555-555555550001', now(), now(), now());

INSERT INTO portal_tokens (id, token_hash, client_id, workspace_id, expires_at, used_at, created_by_user_id, created_at)
VALUES
  ('dddddddd-dddd-dddd-dddd-ddddddddd001', 'p921_valid_hash_001', '99999999-9999-9999-9999-999999990001', '88888888-8888-8888-8888-888888880001', now() + interval '24 hours', now(), '55555555-5555-5555-5555-555555550001', now()),
  ('dddddddd-dddd-dddd-dddd-ddddddddd002', 'p921_revoked_hash', '99999999-9999-9999-9999-999999990001', '88888888-8888-8888-8888-888888880001', now() + interval '24 hours', now(), '55555555-5555-5555-5555-555555550001', now()),
  ('dddddddd-dddd-dddd-dddd-ddddddddd003', 'p921_expired_hash', '99999999-9999-9999-9999-999999990001', '88888888-8888-8888-8888-888888880001', now() - interval '1 hour', now(), '55555555-5555-5555-5555-555555550001', now());

-- ───────────────────────────────────────────────────────────────
-- Test 1: New columns exist on invoices
-- ───────────────────────────────────────────────────────────────
SELECT has_column('invoices', 'payment_url_expires_at', 'invoices.payment_url_expires_at column exists');
SELECT has_column('invoices', 'stripe_checkout_session_id', 'invoices.stripe_checkout_session_id column exists');

-- ───────────────────────────────────────────────────────────────
-- Test 2: New columns exist on weekly_reports
-- ───────────────────────────────────────────────────────────────
SELECT has_column('weekly_reports', 'client_feedback', 'weekly_reports.client_feedback column exists');
SELECT has_column('weekly_reports', 'feedback_at', 'weekly_reports.feedback_at column exists');

-- ───────────────────────────────────────────────────────────────
-- Test 3: client_notification_logs table exists with RLS
-- ───────────────────────────────────────────────────────────────
SELECT has_table('client_notification_logs', 'client_notification_logs table exists');
SELECT is(
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'client_notification_logs'),
  true,
  'RLS is enabled on client_notification_logs'
);

-- ───────────────────────────────────────────────────────────────
-- Test 4: Portal role has SELECT grant on all five tables
-- ───────────────────────────────────────────────────────────────
SELECT ok(has_table_privilege('portal', 'invoices', 'SELECT'), 'portal role can SELECT invoices');
SELECT ok(has_table_privilege('portal', 'invoice_line_items', 'SELECT'), 'portal role can SELECT invoice_line_items');
SELECT ok(has_table_privilege('portal', 'invoice_payments', 'SELECT'), 'portal role can SELECT invoice_payments');
SELECT ok(has_table_privilege('portal', 'weekly_reports', 'SELECT'), 'portal role can SELECT weekly_reports');
SELECT ok(has_table_privilege('portal', 'weekly_report_sections', 'SELECT'), 'portal role can SELECT weekly_report_sections');

-- ───────────────────────────────────────────────────────────────
-- Test 5: Portal role CANNOT INSERT/UPDATE/DELETE any of the five tables
-- ───────────────────────────────────────────────────────────────
SELECT ok(
  NOT has_table_privilege('portal', 'invoices', 'INSERT'),
  'portal role CANNOT INSERT invoices'
);
SELECT ok(
  NOT has_table_privilege('portal', 'invoices', 'UPDATE'),
  'portal role CANNOT UPDATE invoices'
);
SELECT ok(
  NOT has_table_privilege('portal', 'invoices', 'DELETE'),
  'portal role CANNOT DELETE invoices'
);
SELECT ok(
  NOT has_table_privilege('portal', 'weekly_reports', 'INSERT'),
  'portal role CANNOT INSERT weekly_reports'
);
SELECT ok(
  NOT has_table_privilege('portal', 'weekly_reports', 'UPDATE'),
  'portal role CANNOT UPDATE weekly_reports'
);
SELECT ok(
  NOT has_table_privilege('portal', 'weekly_reports', 'DELETE'),
  'portal role CANNOT DELETE weekly_reports'
);

-- ───────────────────────────────────────────────────────────────
-- Test 6: Portal SELECT policies exist on all five tables
-- ───────────────────────────────────────────────────────────────
SELECT ok(
  EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invoices' AND policyname = 'rls_invoices_portal_select'),
  'Portal SELECT policy exists on invoices'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invoice_line_items' AND policyname = 'rls_invoice_line_items_portal_select'),
  'Portal SELECT policy exists on invoice_line_items'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invoice_payments' AND policyname = 'rls_invoice_payments_portal_select'),
  'Portal SELECT policy exists on invoice_payments'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'weekly_reports' AND policyname = 'rls_weekly_reports_portal_select'),
  'Portal SELECT policy exists on weekly_reports'
);
SELECT ok(
  EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'weekly_report_sections' AND policyname = 'rls_weekly_report_sections_portal_select'),
  'Portal SELECT policy exists on weekly_report_sections'
);

-- ───────────────────────────────────────────────────────────────
-- Test 7: SECURITY DEFINER RPCs exist and are granted only to portal
-- ───────────────────────────────────────────────────────────────
SELECT has_function('approve_report_via_portal', ARRAY['uuid','uuid'], 'approve_report_via_portal RPC exists');
SELECT has_function('request_report_changes_via_portal', ARRAY['uuid','uuid','text'], 'request_report_changes_via_portal RPC exists');
SELECT has_function('refresh_portal_checkout_url', ARRAY['uuid','uuid','text','text','timestamptz'], 'refresh_portal_checkout_url RPC exists');
SELECT has_function('verify_portal_jwt_identity', ARRAY[]::text[], 'verify_portal_jwt_identity helper RPC exists');

-- ───────────────────────────────────────────────────────────────
-- Test 8: approve_report_via_portal rejects call without valid JWT context
-- ───────────────────────────────────────────────────────────────
SELECT is(
  approve_report_via_portal('cccccccc-cccc-cccc-cccc-ccccccccc001', '99999999-9999-9999-9999-999999990001'::uuid),
  'FORBIDDEN',
  'approve_report_via_portal returns FORBIDDEN without valid portal JWT'
);

-- ───────────────────────────────────────────────────────────────
-- Test 9-11: approve_report_via_portal with valid JWT context
-- ───────────────────────────────────────────────────────────────
SELECT set_config('request.jwt.claims', json_build_object(
  'client_id', '99999999-9999-9999-9999-999999990001',
  'portal_token_id', 'dddddddd-dddd-dddd-dddd-ddddddddd001'
)::text, true);

SELECT is(
  approve_report_via_portal('cccccccc-cccc-cccc-cccc-ccccccccc001', '99999999-9999-9999-9999-999999990001'::uuid),
  'OK',
  'approve_report_via_portal returns OK for correct client + valid token'
);

SELECT is(
  approve_report_via_portal('cccccccc-cccc-cccc-cccc-ccccccccc001', '99999999-9999-9999-9999-999999990001'::uuid),
  'INVALID_STATE',
  'approve_report_via_portal returns INVALID_STATE for already-approved report'
);

-- Reset report to sent for request-changes tests
UPDATE weekly_reports SET status = 'sent', client_feedback = NULL, feedback_at = NULL WHERE id = 'cccccccc-cccc-cccc-cccc-ccccccccc001';

-- ───────────────────────────────────────────────────────────────
-- Test 12-13: request_report_changes_via_portal rejects invalid message
-- ───────────────────────────────────────────────────────────────
SELECT is(
  request_report_changes_via_portal('cccccccc-cccc-cccc-cccc-ccccccccc001', '99999999-9999-9999-9999-999999990001'::uuid, ''),
  'INVALID_MESSAGE',
  'request_report_changes_via_portal rejects empty message'
);
SELECT is(
  request_report_changes_via_portal('cccccccc-cccc-cccc-cccc-ccccccccc001', '99999999-9999-9999-9999-999999990001'::uuid, repeat('x', 2001)),
  'INVALID_MESSAGE',
  'request_report_changes_via_portal rejects message >2000 chars'
);

-- ───────────────────────────────────────────────────────────────
-- Test 14: request_report_changes_via_portal rejects cross-client
-- ───────────────────────────────────────────────────────────────
SELECT is(
  request_report_changes_via_portal('cccccccc-cccc-cccc-cccc-ccccccccc001', '99999999-9999-9999-9999-999999990002'::uuid, 'valid message'),
  'FORBIDDEN',
  'request_report_changes_via_portal returns FORBIDDEN for mismatched p_client_id'
);

-- ───────────────────────────────────────────────────────────────
-- Test 15: request_report_changes_via_portal happy path
-- ───────────────────────────────────────────────────────────────
SELECT is(
  request_report_changes_via_portal('cccccccc-cccc-cccc-cccc-ccccccccc001', '99999999-9999-9999-9999-999999990001'::uuid, 'Please fix the hours.'),
  'OK',
  'request_report_changes_via_portal returns OK for valid request'
);

-- ───────────────────────────────────────────────────────────────
-- Test 16-17: refresh_portal_checkout_url negative cases
-- ───────────────────────────────────────────────────────────────
SELECT is(
  refresh_portal_checkout_url('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001', '99999999-9999-9999-9999-999999990001'::uuid, 'https://checkout.stripe.com/test', 'cs_test', now() - interval '1 minute'),
  'INVALID_INPUT',
  'refresh_portal_checkout_url rejects expired p_expires_at'
);
SELECT is(
  refresh_portal_checkout_url('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa001', '99999999-9999-9999-9999-999999990001'::uuid, 'https://checkout.stripe.com/test', 'cs_test', now() + interval '1 hour'),
  'OK',
  'refresh_portal_checkout_url returns OK for valid input'
);

-- ───────────────────────────────────────────────────────────────
-- Test 18: refresh_portal_checkout_url rejects draft invoice
-- ───────────────────────────────────────────────────────────────
SELECT is(
  refresh_portal_checkout_url('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa002', '99999999-9999-9999-9999-999999990001'::uuid, 'https://checkout.stripe.com/test', 'cs_test', now() + interval '1 hour'),
  'INVALID_STATE',
  'refresh_portal_checkout_url returns INVALID_STATE for draft invoice'
);

-- ───────────────────────────────────────────────────────────────
-- Test 19: refresh_portal_checkout_url rejects archived client's invoice
-- ───────────────────────────────────────────────────────────────
SELECT is(
  refresh_portal_checkout_url('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa003', '99999999-9999-9999-9999-999999990003'::uuid, 'https://checkout.stripe.com/test', 'cs_test', now() + interval '1 hour'),
  'FORBIDDEN',
  'refresh_portal_checkout_url returns FORBIDDEN for archived client invoice'
);

-- ───────────────────────────────────────────────────────────────
-- Test 20: revoke portal token and ensure RPCs reject
-- ───────────────────────────────────────────────────────────────
UPDATE portal_tokens SET revoked_at = now() WHERE id = 'dddddddd-dddd-dddd-dddd-ddddddddd001';

SELECT is(
  approve_report_via_portal('cccccccc-cccc-cccc-cccc-ccccccccc001', '99999999-9999-9999-9999-999999990001'::uuid),
  'FORBIDDEN',
  'approve_report_via_portal returns FORBIDDEN when portal token is revoked'
);

-- ───────────────────────────────────────────────────────────────
-- Cleanup
-- ───────────────────────────────────────────────────────────────
DELETE FROM weekly_report_sections WHERE report_id IN (
  SELECT id FROM weekly_reports WHERE workspace_id = '88888888-8888-8888-8888-888888880001'
);
DELETE FROM weekly_reports WHERE workspace_id = '88888888-8888-8888-8888-888888880001';
DELETE FROM invoice_line_items WHERE workspace_id = '88888888-8888-8888-8888-888888880001';
DELETE FROM invoices WHERE workspace_id = '88888888-8888-8888-8888-888888880001';
DELETE FROM portal_tokens WHERE workspace_id = '88888888-8888-8888-8888-888888880001';
DELETE FROM client_notification_logs WHERE workspace_id = '88888888-8888-8888-8888-888888880001';
DELETE FROM clients WHERE workspace_id = '88888888-8888-8888-8888-888888880001';
DELETE FROM workspaces WHERE id = '88888888-8888-8888-8888-888888880001';

SELECT * FROM finish();

ROLLBACK;
