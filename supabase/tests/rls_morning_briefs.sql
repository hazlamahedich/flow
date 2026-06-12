-- TC-13: RLS tests for morning_briefs
BEGIN;
SELECT plan(8);

-- Setup test data
SET ROLE postgres;

INSERT INTO workspaces (id, name, slug)
VALUES 
  ('550e8400-e29b-41d4-a716-44665544000a', 'Workspace A', 'ws-a'),
  ('550e8400-e29b-41d4-a716-44665544000b', 'Workspace B', 'ws-b');

INSERT INTO auth.users (id, email, raw_user_meta_data, created_at, updated_at) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'user-a@example.com', '{}', now(), now()),
  ('550e8400-e29b-41d4-a716-446655440002', 'user-b@example.com', '{}', now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', 'user-a@example.com'),
  ('550e8400-e29b-41d4-a716-446655440002', 'user-b@example.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role)
VALUES 
  ('550e8400-e29b-41d4-a716-44665544000a', '550e8400-e29b-41d4-a716-446655440001', 'owner'),
  ('550e8400-e29b-41d4-a716-44665544000b', '550e8400-e29b-41d4-a716-446655440002', 'owner');

INSERT INTO morning_briefs (workspace_id, brief_date, content, generation_status)
VALUES 
  ('550e8400-e29b-41d4-a716-44665544000a', '2026-05-05', '{"summaryLine": "Brief A"}', 'completed'),
  ('550e8400-e29b-41d4-a716-44665544000b', '2026-05-05', '{"summaryLine": "Brief B"}', 'completed');

RESET ROLE;

-- Test SELECT as User A
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "550e8400-e29b-41d4-a716-446655440001", "workspace_id": "550e8400-e29b-41d4-a716-44665544000a", "role": "owner"}';
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

RESET ROLE;

-- Test SELECT as User B
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "550e8400-e29b-41d4-a716-446655440002", "workspace_id": "550e8400-e29b-41d4-a716-44665544000b", "role": "owner"}';
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

RESET ROLE;

-- Test UPDATE viewed_at
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "550e8400-e29b-41d4-a716-446655440001", "workspace_id": "550e8400-e29b-41d4-a716-44665544000a", "role": "owner"}';
SELECT lives_ok(
    $$ UPDATE morning_briefs SET viewed_at = now() WHERE workspace_id = '550e8400-e29b-41d4-a716-44665544000a' $$,
    'User A can mark their own brief as viewed'
);

RESET ROLE;
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "550e8400-e29b-41d4-a716-446655440001", "workspace_id": "550e8400-e29b-41d4-a716-44665544000a", "role": "owner"}';
SELECT results_eq(
    $$ SELECT count(*)::int FROM morning_briefs WHERE viewed_at IS NOT NULL $$,
    $$ SELECT 1 $$,
    'viewed_at should be updated'
);

RESET ROLE;

-- Test INSERT (should fail for authenticated users)
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "550e8400-e29b-41d4-a716-446655440001", "workspace_id": "550e8400-e29b-41d4-a716-44665544000a", "role": "owner"}';
SELECT throws_ok(
    $$ INSERT INTO morning_briefs (workspace_id, content) VALUES ('550e8400-e29b-41d4-a716-44665544000a', '{}') $$,
    '42501',
    NULL,
    'Authenticated users cannot insert briefs'
);

RESET ROLE;

-- Test Service Role
SET ROLE service_role;
SELECT lives_ok(
    $$ INSERT INTO morning_briefs (workspace_id, brief_date, content) VALUES ('550e8400-e29b-41d4-a716-44665544000a', '2026-05-06', '{}') $$,
    'Service role can insert briefs'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
