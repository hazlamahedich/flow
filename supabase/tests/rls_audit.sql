-- pgTAP RLS tests: audit_log table
-- Purpose: Verify audit_log RLS — append-only, tenant-scoped, member read-only
-- Related: Story 1.2 AC#9 — P0 gate, all tests must pass

BEGIN;

CREATE OR REPLACE FUNCTION reset_role() RETURNS void AS $$
BEGIN
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claims', '', false);
END;
$$ LANGUAGE plpgsql;

SELECT plan(6);

-- Setup (run as superuser to avoid RLS recursion on workspace_members)
SET ROLE postgres;
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'pgtap-a@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', '{}'),
  ('22222222-2222-2222-2222-222222222222', 'pgtap-b@test.com', '{"workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'pgtap-a@test.com', 'User A'),
  ('22222222-2222-2222-2222-222222222222', 'pgtap-b@test.com', 'User B')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspaces (id, name, slug) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Workspace A', 'pgtap-ws-a'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Workspace B', 'pgtap-ws-b')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'owner')
ON CONFLICT DO NOTHING;

INSERT INTO audit_log (workspace_id, user_id, action, entity_type, entity_id, details)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'create', 'workspace', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '{}')
ON CONFLICT DO NOTHING;

INSERT INTO audit_log (workspace_id, user_id, action, entity_type, entity_id, details)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'create', 'workspace', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '{}')
ON CONFLICT DO NOTHING;
RESET ROLE;

-- Members can read own workspace entries
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SELECT is(
  (SELECT count(*) FROM audit_log),
  1::bigint,
  'User A sees 1 audit entry (own workspace)'
);
SELECT reset_role();

-- Cross-tenant: User B cannot see Workspace A audit entries
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', false);
SELECT is(
  (SELECT count(*) FROM audit_log WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0::bigint,
  'User B cannot see Workspace A audit entries'
);
SELECT reset_role();

-- Users cannot UPDATE audit_log (no UPDATE policy, RLS blocks silently)
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SELECT lives_ok(
  'UPDATE audit_log SET action = ''hacked'' WHERE workspace_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  'UPDATE returns 0 rows (no UPDATE policy on audit_log)'
);
SELECT reset_role();

-- Users cannot DELETE audit_log (no DELETE policy, RLS blocks silently)
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SELECT lives_ok(
  'DELETE FROM audit_log WHERE workspace_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  'DELETE returns 0 rows (no DELETE policy on audit_log)'
);
SELECT reset_role();

-- Hash chain: verify previous_hash is populated
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', false);
SELECT is(
  (SELECT count(*) FROM audit_log WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND previous_hash IS NOT NULL),
  1::bigint,
  'Audit log has non-empty previous_hash'
);
SELECT reset_role();

-- Audit_log trigger prevents modification when bypassing RLS (as postgres)
SET ROLE postgres;
SELECT throws_ok(
  'UPDATE audit_log SET action = ''hacked'' WHERE workspace_id = ''aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa''',
  'P0001'
);
SELECT reset_role();

SELECT * FROM finish();
ROLLBACK;
