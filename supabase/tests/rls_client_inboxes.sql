-- Test: RLS policies for client_inboxes table
-- Related: AC5 (cross-client isolation)

BEGIN;

SELECT plan(8);

-- Seed test data
SELECT test_helper.create_test_workspace('ws1'::uuid, 'Workspace 1');
SELECT test_helper.create_test_workspace('ws2'::uuid, 'Workspace 2');
SELECT test_helper.create_test_user('u1'::uuid, 'ws1'::uuid, 'owner');
SELECT test_helper.create_test_user('u2'::uuid, 'ws2'::uuid, 'owner');
SELECT test_helper.create_test_user('u3'::uuid, 'ws1'::uuid, 'member');
SELECT test_helper.create_test_client('c1'::uuid, 'ws1'::uuid, 'Client 1');
SELECT test_helper.create_test_client('c2'::uuid, 'ws2'::uuid, 'Client 2');

-- Test: Owner can insert inbox
SELECT results_eq(
  $$
    INSERT INTO client_inboxes (workspace_id, client_id, email_address, access_type)
    VALUES ('ws1', 'c1', 'test1@gmail.com', 'direct')
    RETURNING id
  $$,
  $$
    SELECT set_config('role', 'authenticated', true);
    SELECT set_config('request.jwt.claims', json_build_object('workspace_id', 'ws1', 'sub', 'u1', 'role', 'owner')::text, true);
    INSERT INTO client_inboxes (workspace_id, client_id, email_address, access_type)
    VALUES ('ws1', 'c1', 'test1@gmail.com', 'direct')
    RETURNING id
  $$,
  'Owner can insert inbox'
);

-- Test: Workspace isolation (ws2 owner cannot read ws1 inboxes)
SELECT throws_ok(
  $$
    SET request.jwt.claims = '{"workspace_id": "ws2", "sub": "u2", "role": "owner"}';
    SELECT * FROM client_inboxes WHERE workspace_id = 'ws1'
  $$,
  'Workspace 2 user cannot read workspace 1 inboxes'
);

-- Test: service_role has full access
SELECT lives_ok(
  $$
    SET role = 'service_role';
    SELECT * FROM client_inboxes WHERE workspace_id = 'ws1'
  $$,
  'service_role can read all inboxes'
);

SELECT finish();
ROLLBACK;
