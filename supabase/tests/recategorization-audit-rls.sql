-- Test: RLS policies for recategorization_log table
-- Related: Story 4.4c AC9 (Recategorization Tracking)

BEGIN;

SELECT plan(6);

-- Setup test workspaces and inboxes
INSERT INTO workspaces (id, name, slug) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Workspace A', 'workspace-a'),
  ('22222222-2222-2222-2222-222222222222', 'Workspace B', 'workspace-b');

INSERT INTO client_inboxes (id, workspace_id, email_address) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'inbox-a@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'inbox-b@example.com');

-- 1. Test Select Isolation
INSERT INTO recategorization_log (id, email_id, workspace_id, client_inbox_id, old_category, new_category, user_id)
VALUES 
  ('c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1', gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'noise', 'info', gen_random_uuid()),
  ('c2c2c2c2-c2c2-c2c2-c2c2-c2c2c2c2c2c2', gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'info', 'urgent', gen_random_uuid());

-- Switch to User in Workspace A
SELECT set_config('role', 'authenticated', true);
SELECT set_config('request.jwt.claims', '{"sub": "user-a", "workspace_id": "11111111-1111-1111-1111-111111111111"}', true);

SELECT results_eq(
  'SELECT id FROM recategorization_log',
  'ARRAY[''c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1''::uuid]',
  'User A should only see logs from Workspace A'
);

-- 2. Test Insert Isolation (Allowed)
SELECT lives_ok(
  $$
    INSERT INTO recategorization_log (email_id, workspace_id, client_inbox_id, old_category, new_category, user_id)
    VALUES (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'noise', 'info', '00000000-0000-0000-0000-000000000000')
  $$,
  'User A can insert log into their own workspace/inbox'
);

-- 3. Test Insert Isolation (Denied - Wrong Workspace)
SELECT throws_ok(
  $$
    INSERT INTO recategorization_log (email_id, workspace_id, client_inbox_id, old_category, new_category, user_id)
    VALUES (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'noise', 'info', '00000000-0000-0000-0000-000000000000')
  $$,
  'new row violates row-level security policy for table "recategorization_log"',
  'User A cannot insert log into Workspace B'
);

-- 4. Test Insert Isolation (Denied - Wrong Inbox in own Workspace)
INSERT INTO client_inboxes (id, workspace_id, email_address) 
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'inbox-c@example.com');

SELECT throws_ok(
  $$
    INSERT INTO recategorization_log (email_id, workspace_id, client_inbox_id, old_category, new_category, user_id)
    VALUES (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'noise', 'info', '00000000-0000-0000-0000-000000000000')
  $$,
  'new row violates row-level security policy for table "recategorization_log"',
  'User A cannot insert log into an inbox belonging to another workspace'
);

-- 5. Test Service Role Bypass
SELECT set_config('role', 'service_role', true);
SELECT is(
  (SELECT count(*)::int FROM recategorization_log),
  3,
  'service_role can see all logs (2 initial + 1 from successful insert)'
);

-- 6. Test Service Role Insert
SELECT lives_ok(
  $$
    INSERT INTO recategorization_log (email_id, workspace_id, client_inbox_id, old_category, new_category, user_id)
    VALUES (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'noise', 'info', '00000000-0000-0000-0000-000000000000')
  $$,
  'service_role can insert logs for any workspace'
);

SELECT finish();
ROLLBACK;
