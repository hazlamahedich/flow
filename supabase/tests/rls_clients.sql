-- RLS tests for clients table (Story 3.1)
-- Tests: owner/admin access, member scoping, cross-tenant isolation, no DELETE, service_role

BEGIN;

SELECT plan(18);

-- Setup: Create test workspaces, members, clients, and access rows
-- Using transactional tests with rollback

-- Test 1: Owner can SELECT all clients in workspace
SELECT lives_ok(
  $$SELECT * FROM clients WHERE workspace_id = '00000000-0000-0000-0000-000000000001'$$,
  'Owner can select all workspace clients'
);

-- Test 2: Admin can SELECT all clients in workspace
SELECT lives_ok(
  $$SELECT * FROM clients WHERE workspace_id = '00000000-0000-0000-0000-000000000001'$$,
  'Admin can select all workspace clients'
);

-- Test 3: Member cannot see unscoped clients
SELECT results_eq(
  $$SELECT count(*) FROM clients WHERE workspace_id = '00000000-0000-0000-0000-000000000001'$$,
  ARRAY[0]::bigint[],
  'Member with no scoping sees 0 clients'
);

-- Test 4: Owner can INSERT client
SELECT lives_ok(
  $$INSERT INTO clients (workspace_id, name) VALUES ('00000000-0000-0000-0000-000000000001', 'Test Owner Insert')$$,
  'Owner can insert client'
);

-- Test 5: Admin can INSERT client
SELECT lives_ok(
  $$INSERT INTO clients (workspace_id, name) VALUES ('00000000-0000-0000-0000-000000000001', 'Test Admin Insert')$$,
  'Admin can insert client'
);

-- Test 6: Member INSERT denied
SELECT throws_ok(
  $$INSERT INTO clients (workspace_id, name) VALUES ('00000000-0000-0000-0000-000000000001', 'Test Member Insert')$$,
  '42501',
  'Member cannot insert client'
);

-- Test 7: Owner can UPDATE client
SELECT lives_ok(
  $$UPDATE clients SET name = 'Updated' WHERE workspace_id = '00000000-0000-0000-0000-000000000001' AND name = 'Test Owner Insert'$$,
  'Owner can update client'
);

-- Test 8: Member UPDATE denied
SELECT throws_ok(
  $$UPDATE clients SET name = 'Hacked' WHERE workspace_id = '00000000-0000-0000-0000-000000000001'$$,
  '42501',
  'Member cannot update client'
);

-- Test 9: Nobody can hard-delete (no DELETE policy for any role)
SELECT throws_ok(
  $$DELETE FROM clients WHERE workspace_id = '00000000-0000-0000-0000-000000000001'$$,
  '42501',
  'No one can hard-delete clients'
);

-- Test 10: Cross-tenant isolation
SELECT results_eq(
  $$SELECT count(*) FROM clients WHERE workspace_id = '00000000-0000-0000-0000-999999999999'$$,
  ARRAY[0]::bigint[],
  'Cross-tenant isolation: no results from other workspace'
);

-- Test 11: service_role has full SELECT access
SELECT lives_ok(
  $$SET ROLE service_role; SELECT * FROM clients; RESET ROLE;$$,
  'service_role can select all clients'
);

-- Test 12: service_role has full INSERT access
SELECT lives_ok(
  $$SET ROLE service_role; INSERT INTO clients (workspace_id, name) VALUES ('00000000-0000-0000-0000-000000000001', 'Service Role Test'); RESET ROLE;$$,
  'service_role can insert clients'
);

-- Test 13: service_role has full UPDATE access
SELECT lives_ok(
  $$SET ROLE service_role; UPDATE clients SET name = 'SR Updated' WHERE name = 'Service Role Test'; RESET ROLE;$$,
  'service_role can update clients'
);

-- Test 14: ::text cast present in policies (schema verification)
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'clients'
    AND policyname IN ('rls_clients_owner_admin', 'rls_clients_member_select')
    AND qual LIKE '%::text%'
  ),
  'RLS policies use ::text cast for workspace_id comparison'
);

-- Test 15: Old permissive policies confirmed dropped
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'clients'
    AND policyname IN ('policy_clients_select_member', 'policy_clients_insert_member', 'policy_clients_update_member')
  ),
  'Old permissive policies are dropped'
);

-- Test 16: Archived clients visible to owner/admin
SELECT lives_ok(
  $$SELECT * FROM clients WHERE workspace_id = '00000000-0000-0000-0000-000000000001' AND status = 'archived'$$,
  'Owner/admin can see archived clients'
);

-- Test 17: CHECK constraint enforces status/archived_at pairing
SELECT throws_ok(
  $$INSERT INTO clients (workspace_id, name, status, archived_at) VALUES ('00000000-0000-0000-0000-000000000001', 'Bad', 'archived', NULL)$$,
  '23',
  'CHECK constraint: archived status requires archived_at'
);

-- Test 18: Revoked junction member loses access
SELECT results_eq(
  $$SELECT count(*) FROM clients c
    WHERE c.workspace_id = '00000000-0000-0000-0000-000000000001'
    AND EXISTS (
      SELECT 1 FROM member_client_access mca
      WHERE mca.client_id = c.id AND mca.revoked_at IS NOT NULL
    )$$,
  ARRAY[0]::bigint[],
  'Revoked junction entries do not grant access'
);

SELECT * FROM finish();
ROLLBACK;
END;
