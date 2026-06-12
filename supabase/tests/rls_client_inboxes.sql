-- Test: RLS policies for client_inboxes table
-- Related: AC5 (cross-client isolation)

BEGIN;

SELECT plan(8);

SET ROLE postgres;

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('11111111-1111-1111-1111-111111111101', 'pgtap-owner1@test.com', '{}', '{}'),
  ('11111111-1111-1111-1111-111111111102', 'pgtap-owner2@test.com', '{}', '{}'),
  ('11111111-1111-1111-1111-111111111103', 'pgtap-member1@test.com', '{}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, name) VALUES
  ('11111111-1111-1111-1111-111111111101', 'pgtap-owner1@test.com', 'Owner1'),
  ('11111111-1111-1111-1111-111111111102', 'pgtap-owner2@test.com', 'Owner2'),
  ('11111111-1111-1111-1111-111111111103', 'pgtap-member1@test.com', 'Member1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspaces (id, name, slug) VALUES
  ('21111111-1111-1111-1111-111111111101', 'Workspace 1', 'pgtap-cib-ws1'),
  ('21111111-1111-1111-1111-111111111102', 'Workspace 2', 'pgtap-cib-ws2')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role, status) VALUES
  ('21111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111101', 'owner', 'active'),
  ('21111111-1111-1111-1111-111111111102', '11111111-1111-1111-1111-111111111102', 'owner', 'active'),
  ('21111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111103', 'member', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO clients (id, workspace_id, name, email) VALUES
  ('31111111-1111-1111-1111-111111111101', '21111111-1111-1111-1111-111111111101', 'Client 1', 'c1@test.com'),
  ('31111111-1111-1111-1111-111111111102', '21111111-1111-1111-1111-111111111102', 'Client 2', 'c2@test.com')
ON CONFLICT (id) DO NOTHING;

-- Grant member access to client in ws1
INSERT INTO member_client_access (workspace_id, user_id, client_id, granted_by) VALUES
  ('21111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111103', '31111111-1111-1111-1111-111111111101', '11111111-1111-1111-1111-111111111101')
ON CONFLICT DO NOTHING;

RESET ROLE;

-- Test 1: Owner can SELECT empty inboxes initially
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111101", "workspace_id": "21111111-1111-1111-1111-111111111101", "role": "owner"}';
SELECT results_eq(
  'SELECT count(*)::int FROM client_inboxes WHERE workspace_id = ''21111111-1111-1111-1111-111111111101''',
  ARRAY[0::int],
  'Owner sees 0 inboxes initially'
);
RESET ROLE;

-- Test 2: Owner can INSERT inbox in own workspace
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111101", "workspace_id": "21111111-1111-1111-1111-111111111101", "role": "owner"}';
SELECT lives_ok(
  $$INSERT INTO client_inboxes (workspace_id, client_id, email_address, access_type) VALUES ('21111111-1111-1111-1111-111111111101', '31111111-1111-1111-1111-111111111101', 'test1@gmail.com', 'direct')$$,
  'Owner can insert inbox'
);
RESET ROLE;

-- Test 3: Owner can SELECT after insert
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111101", "workspace_id": "21111111-1111-1111-1111-111111111101", "role": "owner"}';
SELECT results_eq(
  'SELECT count(*)::int FROM client_inboxes WHERE workspace_id = ''21111111-1111-1111-1111-111111111101''',
  ARRAY[1::int],
  'Owner sees 1 inbox after insert'
);
RESET ROLE;

-- Test 4: Workspace isolation
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111102", "workspace_id": "21111111-1111-1111-1111-111111111102", "role": "owner"}';
SELECT results_eq(
  'SELECT count(*)::int FROM client_inboxes WHERE workspace_id = ''21111111-1111-1111-1111-111111111101''',
  ARRAY[0::int],
  'Workspace 2 user cannot read workspace 1 inboxes'
);
RESET ROLE;

-- Test 5: service_role can read all inboxes
SET ROLE service_role;
SELECT lives_ok(
  $$SELECT * FROM client_inboxes WHERE workspace_id = '21111111-1111-1111-1111-111111111101'$$,
  'service_role can read all inboxes'
);
RESET ROLE;

-- Test 6: Member can SELECT inboxes in workspace
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111103", "workspace_id": "21111111-1111-1111-1111-111111111101", "role": "member"}';
SELECT results_eq(
  'SELECT count(*)::int FROM client_inboxes WHERE workspace_id = ''21111111-1111-1111-1111-111111111101''',
  ARRAY[1::int],
  'Member sees inboxes for accessible client'
);
RESET ROLE;

-- Test 7: Owner INSERT into other workspace denied
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111102", "workspace_id": "21111111-1111-1111-1111-111111111102", "role": "owner"}';
SELECT throws_ok(
  $$INSERT INTO client_inboxes (workspace_id, client_id, email_address, access_type) VALUES ('21111111-1111-1111-1111-111111111101', '31111111-1111-1111-1111-111111111101', 'hack@gmail.com', 'direct')$$,
  '42501'
);
RESET ROLE;

-- Test 8: Member cannot INSERT (no member INSERT policy)
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111103", "workspace_id": "21111111-1111-1111-1111-111111111101", "role": "member"}';
SELECT throws_ok(
  $$INSERT INTO client_inboxes (workspace_id, client_id, email_address, access_type) VALUES ('21111111-1111-1111-1111-111111111101', '31111111-1111-1111-1111-111111111101', 'member@gmail.com', 'delegated')$$,
  '42501'
);
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
