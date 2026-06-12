-- Test: RLS policies for recategorization_log table
-- Related: Story 4.4c AC9 (Recategorization Tracking)

BEGIN;

SELECT plan(6);

SET ROLE postgres;

-- Setup test workspaces, users, clients, and inboxes
INSERT INTO workspaces (id, name, slug) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Workspace A', 'workspace-a'),
  ('22222222-2222-2222-2222-222222222222', 'Workspace B', 'workspace-b');

INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'user-a@test.com', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'user-a@test.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role, status) VALUES
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'owner', 'active')
ON CONFLICT DO NOTHING;

INSERT INTO clients (id, workspace_id, name, email) VALUES
  ('c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Client A', 'client-a@example.com'),
  ('c2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Client B', 'client-b@example.com'),
  ('c3333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'Client C', 'client-c@example.com');

INSERT INTO member_client_access (workspace_id, user_id, client_id, granted_by) VALUES
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
ON CONFLICT DO NOTHING;

INSERT INTO client_inboxes (id, workspace_id, client_id, email_address, access_type) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'inbox-a@example.com', 'direct'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222222', 'inbox-b@example.com', 'direct'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'c3333333-3333-3333-3333-333333333333', 'inbox-c@example.com', 'direct');

-- Seed recategorization_log entries
INSERT INTO recategorization_log (id, email_id, workspace_id, client_inbox_id, old_category, new_category, user_id)
VALUES 
  ('c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1', gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'noise', 'info', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('c2c2c2c2-c2c2-c2c2-c2c2-c2c2c2c2c2c2', gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'info', 'urgent', gen_random_uuid());

-- 1. Test Select Isolation — User A should only see Workspace A logs
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "workspace_id": "11111111-1111-1111-1111-111111111111"}';

SELECT results_eq(
  $$SELECT id FROM recategorization_log ORDER BY id$$,
  $$SELECT 'c1c1c1c1-c1c1-c1c1-c1c1-c1c1c1c1c1c1'::uuid$$,
  'User A should only see logs from Workspace A'
);

-- 2. Test Insert Isolation (Allowed — own workspace + own inbox)
SELECT lives_ok(
  $$
    INSERT INTO recategorization_log (email_id, workspace_id, client_inbox_id, old_category, new_category, user_id)
    VALUES (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'noise', 'info', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
  $$,
  'User A can insert log into their own workspace/inbox'
);

-- 3. Test Insert Isolation (Denied — Wrong Workspace)
SELECT throws_ok(
  $$
    INSERT INTO recategorization_log (email_id, workspace_id, client_inbox_id, old_category, new_category, user_id)
    VALUES (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'noise', 'info', '00000000-0000-0000-0000-000000000000')
  $$,
  '42501',
  NULL,
  'User A cannot insert log into Workspace B'
);

-- 4. Test Insert Isolation (Denied — Wrong Inbox in another workspace)
SELECT throws_ok(
  $$
    INSERT INTO recategorization_log (email_id, workspace_id, client_inbox_id, old_category, new_category, user_id)
    VALUES (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'noise', 'info', '00000000-0000-0000-0000-000000000000')
  $$,
  '42501',
  NULL,
  'User A cannot insert log into an inbox belonging to another workspace'
);

-- 5. Test Service Role Bypass
RESET ROLE;
SET ROLE service_role;
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

RESET ROLE;
SELECT finish();
ROLLBACK;
