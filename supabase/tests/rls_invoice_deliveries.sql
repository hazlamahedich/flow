-- Test: RLS policies for invoice_deliveries (Story 7-2)
-- Run: psql -f rls_invoice_deliveries.sql

\set QUIET 1
BEGIN;

-- Setup
SELECT plan(8);

-- Create test workspace, user, member, client, invoice
DO $$
DECLARE
  v_user_id UUID := gen_random_uuid();
  v_workspace_id UUID := gen_random_uuid();
  v_workspace_id_2 UUID := gen_random_uuid();
  v_client_id UUID := gen_random_uuid();
  v_invoice_id UUID := gen_random_uuid();
  v_invoice_id_2 UUID := gen_random_uuid();
  v_delivery_id UUID;
BEGIN
  INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES (v_user_id, 'test@example.com', '{}');
  INSERT INTO workspaces (id, name, slug) VALUES (v_workspace_id, 'Test Workspace', 'test-workspace');
  INSERT INTO workspace_members (workspace_id, user_id, role, status) VALUES (v_workspace_id, v_user_id, 'owner', 'active');
  INSERT INTO clients (id, workspace_id, name, slug, status) VALUES (v_client_id, v_workspace_id, 'Test Client', 'test-client', 'active');
  INSERT INTO invoices (id, workspace_id, client_id, invoice_number, status, issue_date, due_date, total_cents)
    VALUES (v_invoice_id, v_workspace_id, v_client_id, 'INV-2026-001', 'draft', '2026-05-01', '2026-06-01', 10000);

  -- Second workspace + invoice for cross-workspace test
  INSERT INTO workspaces (id, name, slug) VALUES (v_workspace_id_2, 'Other Workspace', 'other-workspace');
  INSERT INTO clients (id, workspace_id, name, slug, status) VALUES (gen_random_uuid(), v_workspace_id_2, 'Other Client', 'other-client', 'active');
  INSERT INTO invoices (id, workspace_id, client_id, invoice_number, status, issue_date, due_date, total_cents)
    VALUES (v_invoice_id_2, v_workspace_id_2, gen_random_uuid(), 'INV-2026-002', 'draft', '2026-05-01', '2026-06-01', 5000);

  -- Simulate auth context
  PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- Test 1: member can SELECT invoice_deliveries
  INSERT INTO invoice_deliveries (invoice_id, workspace_id, status)
    VALUES (v_invoice_id, v_workspace_id, 'pending')
    RETURNING id INTO v_delivery_id;

  SELECT results_eq(
    'SELECT id FROM invoice_deliveries WHERE id = ''' || v_delivery_id::text || '''',
    ARRAY[v_delivery_id::text]::TEXT[],
    'member can select invoice_deliveries'
  );

  -- Test 2: member can UPDATE invoice_deliveries
  UPDATE invoice_deliveries SET status = 'sent', sent_at = now() WHERE id = v_delivery_id;
  SELECT results_eq(
    'SELECT status FROM invoice_deliveries WHERE id = ''' || v_delivery_id::text || '''',
    ARRAY['sent']::TEXT[],
    'member can update invoice_deliveries'
  );

  -- Test 3: non-member cannot SELECT
  PERFORM set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  SELECT results_eq(
    'SELECT id FROM invoice_deliveries WHERE workspace_id = ''' || v_workspace_id::text || '''',
    ARRAY[]::TEXT[],
    'non-member cannot select invoice_deliveries'
  );

  -- Test 4: non-member cannot INSERT
  BEGIN
    INSERT INTO invoice_deliveries (invoice_id, workspace_id, status) VALUES (v_invoice_id, v_workspace_id, 'failed');
    SELECT fail('non-member should not insert');
  EXCEPTION WHEN insufficient_privilege THEN
    SELECT pass('non-member cannot insert invoice_deliveries');
  END;

  -- Test 5: non-member cannot UPDATE
  BEGIN
    UPDATE invoice_deliveries SET status = 'failed' WHERE id = v_delivery_id;
    SELECT fail('non-member should not update');
  EXCEPTION WHEN insufficient_privilege THEN
    SELECT pass('non-member cannot update invoice_deliveries');
  END;

  -- Test 6: retry_count defaults to 0
  SELECT results_eq(
    'SELECT retry_count FROM invoice_deliveries WHERE id = ''' || v_delivery_id::text || '''',
    ARRAY[0]::TEXT[],
    'retry_count defaults to 0'
  );

  -- Test 7: member can INSERT (explicit test of INSERT policy with EXISTS check)
  PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);
  BEGIN
    INSERT INTO invoice_deliveries (invoice_id, workspace_id, status) VALUES (v_invoice_id, v_workspace_id, 'pending');
    SELECT pass('member can insert invoice_deliveries');
  EXCEPTION WHEN insufficient_privilege THEN
    SELECT fail('member should be able to insert invoice_deliveries');
  END;

  -- Test 8: member cannot INSERT delivery for cross-workspace invoice
  BEGIN
    INSERT INTO invoice_deliveries (invoice_id, workspace_id, status) VALUES (v_invoice_id_2, v_workspace_id_2, 'pending');
    SELECT fail('member should not insert delivery for other workspace invoice');
  EXCEPTION WHEN insufficient_privilege THEN
    SELECT pass('member cannot insert delivery for cross-workspace invoice');
  END;
END $$;

SELECT * FROM finish();
ROLLBACK;
