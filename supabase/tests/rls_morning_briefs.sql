-- TC-13: RLS tests for morning_briefs
BEGIN;
SELECT plan(8);

-- Setup test data
INSERT INTO workspaces (id, name, slug)
VALUES 
  ('550e8400-e29b-41d4-a716-44665544000a', 'Workspace A', 'ws-a'),
  ('550e8400-e29b-41d4-a716-44665544000b', 'Workspace B', 'ws-b');

INSERT INTO users (id, email)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', 'user-a@example.com'),
  ('550e8400-e29b-41d4-a716-446655440002', 'user-b@example.com');

INSERT INTO workspace_members (workspace_id, user_id, role)
VALUES 
  ('550e8400-e29b-41d4-a716-44665544000a', '550e8400-e29b-41d4-a716-446655440001', 'owner'),
  ('550e8400-e29b-41d4-a716-44665544000b', '550e8400-e29b-41d4-a716-446655440002', 'owner');

INSERT INTO morning_briefs (workspace_id, brief_date, content, generation_status)
VALUES 
  ('550e8400-e29b-41d4-a716-44665544000a', '2026-05-05', '{"summaryLine": "Brief A"}', 'completed'),
  ('550e8400-e29b-41d4-a716-44665544000b', '2026-05-05', '{"summaryLine": "Brief B"}', 'completed');

-- Test SELECT
SELECT tests.authenticate_as('550e8400-e29b-41d4-a716-446655440001');
SELECT is(
    (SELECT count(*)::int FROM morning_briefs),
    1,
    'User A should only see Workspace A brief'
);
SELECT is(
    (SELECT (content->>'summaryLine') FROM morning_briefs),
    'Brief A',
    'User A should see correct brief content'
);

SELECT tests.authenticate_as('550e8400-e29b-41d4-a716-446655440002');
SELECT is(
    (SELECT count(*)::int FROM morning_briefs),
    1,
    'User B should only see Workspace B brief'
);
SELECT is(
    (SELECT (content->>'summaryLine') FROM morning_briefs),
    'Brief B',
    'User B should see correct brief content'
);

-- Test UPDATE viewed_at
SELECT tests.authenticate_as('550e8400-e29b-41d4-a716-446655440001');
SELECT lives_ok(
    $$ UPDATE morning_briefs SET viewed_at = now() WHERE workspace_id = '550e8400-e29b-41d4-a716-44665544000a' $$,
    'User A can mark their own brief as viewed'
);

SELECT results_eq(
    $$ SELECT count(*)::int FROM morning_briefs WHERE viewed_at IS NOT NULL $$,
    $$ SELECT 1 $$,
    'viewed_at should be updated'
);

-- Test INSERT (should fail for authenticated users)
SELECT tests.authenticate_as('550e8400-e29b-41d4-a716-446655440001');
SELECT throws_ok(
    $$ INSERT INTO morning_briefs (workspace_id, content) VALUES ('550e8400-e29b-41d4-a716-44665544000a', '{}') $$,
    'Authenticated users cannot insert briefs'
);

-- Test Service Role
SELECT tests.clear_authentication();
SET ROLE service_role;
SELECT lives_ok(
    $$ INSERT INTO morning_briefs (workspace_id, brief_date, content) VALUES ('550e8400-e29b-41d4-a716-44665544000a', '2026-05-06', '{}') $$,
    'Service role can insert briefs'
);

SELECT * FROM finish();
ROLLBACK;
