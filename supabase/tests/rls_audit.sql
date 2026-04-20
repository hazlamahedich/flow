-- pgTAP RLS tests: audit_log table
-- Purpose: Verify audit_log RLS — append-only, tenant-scoped, member read-only
-- Related: Story 1.2 AC#9 — P0 gate, all tests must pass

BEGIN;

SELECT plan(8);

-- Setup
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'user_a@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', '{}'),
  ('22222222-2222-2222-2222-222222222222', 'user_b@test.com', '{"workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', '{}');

INSERT INTO users (id, email, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'user_a@test.com', 'User A'),
  ('22222222-2222-2222-2222-222222222222', 'user_b@test.com', 'User B');

INSERT INTO workspaces (id, name) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Workspace A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Workspace B');

INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'owner');

-- Insert audit entries via service_role (bypasses RLS for insert)
-- We need to use the hash trigger, so insert directly
INSERT INTO audit_log (workspace_id, user_id, action, entity_type, entity_id, details)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'create', 'workspace', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '{}');

INSERT INTO audit_log (workspace_id, user_id, action, entity_type, entity_id, details)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'create', 'workspace', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '{}');

-- Members can read own workspace entries
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SELECT results_eq(
  'SELECT count(*) FROM audit_log',
  ARRAY[ARRAY['1'::bigint]],
  'User A sees 1 audit entry (own workspace)'
);
SELECT reset_role();

-- Cross-tenant: User B cannot see Workspace A audit entries
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', false);
SELECT results_eq(
  'SELECT count(*) FROM audit_log WHERE workspace_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  ARRAY[ARRAY['0'::bigint]],
  'User B cannot see Workspace A audit entries'
);
SELECT reset_role();

-- Users cannot UPDATE audit_log (append-only)
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SELECT throws_ok(
  'UPDATE audit_log SET action = ''hacked'' WHERE workspace_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  'P0001',
  'Users cannot UPDATE audit_log (append-only enforced by trigger)'
);
SELECT reset_role();

-- Users cannot DELETE audit_log (append-only)
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SELECT throws_ok(
  'DELETE FROM audit_log WHERE workspace_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  'P0001',
  'Users cannot DELETE audit_log (append-only enforced by trigger)'
);
SELECT reset_role();

-- Hash chain: verify previous_hash is populated
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SELECT results_ne(
  'SELECT previous_hash FROM audit_log WHERE workspace_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'' LIMIT 1',
  ARRAY[ARRAY[''::text]],
  'Audit log has non-empty previous_hash'
);
SELECT reset_role();

-- Cleanup
DELETE FROM workspace_members;
DELETE FROM audit_log;
DELETE FROM workspaces;
DELETE FROM users;
DELETE FROM auth.users WHERE id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

SELECT * FROM finish();
ROLLBACK;
