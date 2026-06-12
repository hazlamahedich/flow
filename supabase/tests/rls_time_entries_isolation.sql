-- pgTAP RLS tests: time_entries isolation (TD1 from Epic 5 retrospective)
-- Purpose: Verify cross-workspace denial, member_client_access enforcement,
--          soft-delete filter, user_id attribution on INSERT.
-- Tests the corrected RLS policies from migrations:
--   20260510000002_evolve_time_entries.sql (member_client_access on SELECT/INSERT)
--   20260510000003_fix_rls_policies.sql (member UPDATE scoped to own rows)
--   20260511000001_time_entries_update_policy.sql (final UPDATE policies for 5.3)
-- Related: Epic 5 retro TD1 (P0 production risk)
-- Tables: time_entries, clients, workspace_members, member_client_access

BEGIN;

CREATE OR REPLACE FUNCTION reset_role() RETURNS void AS $$
BEGIN
  EXECUTE 'RESET ROLE';
END;
$$ LANGUAGE plpgsql;

SELECT plan(15);

SET ROLE postgres;

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'pgtap-owner@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}', '{}'),
  ('22222222-2222-2222-2222-222222222222', 'pgtap-admin@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}', '{}'),
  ('33333333-3333-3333-3333-333333333333', 'pgtap-member-a@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', '{}'),
  ('44444444-4444-4444-4444-444444444444', 'pgtap-member-b@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}', '{}'),
  ('66666666-6666-6666-6666-666666666666', 'pgtap-outsider@test.com', '{"workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}', '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'pgtap-owner@test.com', 'Owner'),
  ('22222222-2222-2222-2222-222222222222', 'pgtap-admin@test.com', 'Admin'),
  ('33333333-3333-3333-3333-333333333333', 'pgtap-member-a@test.com', 'MemberA'),
  ('44444444-4444-4444-4444-444444444444', 'pgtap-member-b@test.com', 'MemberB'),
  ('66666666-6666-6666-6666-666666666666', 'pgtap-outsider@test.com', 'Outsider')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspaces (id, name, slug) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Workspace A', 'pgtap-te-iso-ws-a'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Workspace B', 'pgtap-te-iso-ws-b')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role, status) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner', 'active'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'admin', 'active'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'member', 'active'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'member', 'active'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '66666666-6666-6666-6666-666666666666', 'owner', 'active')
ON CONFLICT DO NOTHING;

-- Two clients in Workspace A
INSERT INTO clients (id, workspace_id, name, email) VALUES
  ('c1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Acme Corp', 'acme@test.com'),
  ('c2222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Beta Inc', 'beta@test.com')
ON CONFLICT (id) DO NOTHING;

-- Client in Workspace B
INSERT INTO clients (id, workspace_id, name, email) VALUES
  ('c3333333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Rival Ltd', 'rival@test.com')
ON CONFLICT (id) DO NOTHING;

-- Member A has access to Acme Corp only (NOT Beta Inc)
INSERT INTO member_client_access (workspace_id, user_id, client_id, granted_by) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;

-- Member B has access to both clients
INSERT INTO member_client_access (workspace_id, user_id, client_id, granted_by) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'c2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;

-- Seed time entries
INSERT INTO time_entries (id, workspace_id, client_id, user_id, date, duration_minutes) VALUES
  -- Owner: Acme entry
  ('a0000001-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '2026-05-01', 60),
  -- Owner: Beta entry
  ('a0000001-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '2026-05-01', 45),
  -- Owner: Acme entry SOFT-DELETED
  ('a0000001-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '2026-05-01', 30),
  -- Member B: Beta entry
  ('a0000001-0000-0000-0000-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c2222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444', '2026-05-02', 90)
ON CONFLICT (id) DO NOTHING;

-- Soft-delete entry 3
UPDATE time_entries SET deleted_at = now() WHERE id = 'a0000001-0000-0000-0000-000000000003';

-- ============= TEST 1: member_client_access SELECT enforcement =============
-- Member A can only see Acme entries, NOT Beta entries

SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}';

SELECT is(
  (SELECT count(*) FROM time_entries WHERE client_id = 'c1111111-1111-1111-1111-111111111111'),
  1::bigint,
  'TD1.1: Member A sees Acme entries (has access)'
);

SELECT is(
  (SELECT count(*) FROM time_entries WHERE client_id = 'c2222222-2222-2222-2222-222222222222'),
  0::bigint,
  'TD1.2: Member A cannot see Beta entries (no member_client_access)'
);

SELECT reset_role();

-- ============= TEST 2: member_client_access INSERT enforcement =============
-- Member A cannot INSERT for Beta Inc (no access)

SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}';

SELECT throws_ok(
  $$INSERT INTO time_entries (id, workspace_id, client_id, user_id, date, duration_minutes) VALUES ('a0000001-0000-0000-0000-000000000100', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c2222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', '2026-05-03', 60)$$,
  '42501',
  'new row violates row-level security policy for table "time_entries"',
  'TD1.3: Member A cannot INSERT time entry for inaccessible client'
);

SELECT reset_role();

-- ============= TEST 3: member_client_access INSERT allowed =============
-- Member A CAN INSERT for Acme (has access)

SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}';

SELECT lives_ok(
  $$INSERT INTO time_entries (id, workspace_id, client_id, user_id, date, duration_minutes) VALUES ('a0000001-0000-0000-0000-000000000101', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', '2026-05-03', 60)$$,
  'TD1.4: Member A can INSERT time entry for accessible client'
);

SELECT reset_role();

-- ============= TEST 4: INSERT user_id attribution enforcement =============
-- Member cannot INSERT with different user_id (RLS enforces user_id = auth.uid())

SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}';

SELECT throws_ok(
  $$INSERT INTO time_entries (id, workspace_id, client_id, user_id, date, duration_minutes) VALUES ('a0000001-0000-0000-0000-000000000102', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '2026-05-04', 30)$$,
  '42501',
  'new row violates row-level security policy for table "time_entries"',
  'TD1.5: Member cannot INSERT time entry attributed to another user'
);

SELECT reset_role();

-- ============= TEST 5: Soft-delete filter =============
-- Owner cannot see soft-deleted entries

SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}';

SELECT is(
  (SELECT count(*) FROM time_entries WHERE id = 'a0000001-0000-0000-0000-000000000003'),
  0::bigint,
  'TD1.6: Owner cannot SELECT soft-deleted time entry'
);

SELECT reset_role();

-- ============= TEST 6: Owner/admin see all non-deleted entries =============

SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}';

SELECT is(
  (SELECT count(*) FROM time_entries WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  4::bigint,
  'TD1.7: Owner sees all 4 non-deleted entries (Acme + Beta + member entries)'
);

SELECT reset_role();

-- ============= TEST 7: Cross-workspace denial for member =============
-- Outsider from Workspace B cannot see Workspace A entries

SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "66666666-6666-6666-6666-666666666666", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}';

SELECT is(
  (SELECT count(*) FROM time_entries WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  0::bigint,
  'TD1.8: Cross-workspace SELECT denied (outsider sees 0 entries)'
);

SELECT reset_role();

-- ============= TEST 8: Cross-workspace INSERT denial =============

SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "66666666-6666-6666-6666-666666666666", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}';

SELECT throws_ok(
  $$INSERT INTO time_entries (id, workspace_id, client_id, user_id, date, duration_minutes) VALUES ('a0000001-0000-0000-0000-000000000200', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666', '2026-05-05', 15)$$,
  '42501',
  'new row violates row-level security policy for table "time_entries"',
  'TD1.9: Cross-workspace INSERT denied'
);

SELECT reset_role();

-- ============= TEST 9: Member B sees entries for both clients =============

SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "44444444-4444-4444-4444-444444444444", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}';

SELECT is(
  (SELECT count(*) FROM time_entries WHERE workspace_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  4::bigint,
  'TD1.10: Member B sees entries for all accessible clients'
);

SELECT reset_role();

-- ============= TEST 10: Cannot update deleted entry =============

SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}';

-- Bypass RLS to verify the soft-deleted row exists
SELECT reset_role();
SET ROLE postgres;
SELECT ok(
  EXISTS (SELECT 1 FROM time_entries WHERE id = 'a0000001-0000-0000-0000-000000000003' AND deleted_at IS NOT NULL),
  'TD1.setup: Soft-deleted entry exists in DB'
);
SELECT reset_role();

SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}';

UPDATE time_entries SET duration_minutes = 999 WHERE id = 'a0000001-0000-0000-0000-000000000003';
SELECT is(
  (SELECT count(*) FROM time_entries WHERE id = 'a0000001-0000-0000-0000-000000000003' AND duration_minutes = 999),
  0::bigint,
  'TD1.11: Cannot UPDATE soft-deleted time entry (even as owner)'
);

SELECT reset_role();

-- ============= TEST 11: Admin can update any non-deleted entry =============

SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}';

UPDATE time_entries SET duration_minutes = 75 WHERE id = 'a0000001-0000-0000-0000-000000000001';
SELECT is(
  (SELECT duration_minutes FROM time_entries WHERE id = 'a0000001-0000-0000-0000-000000000001'),
  75,
  'TD1.12: Admin can update any non-deleted entry in workspace'
);

SELECT reset_role();

-- ============= TEST 12: Member cannot update another user entry =============

SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}';

UPDATE time_entries SET duration_minutes = 999 WHERE id = 'a0000001-0000-0000-0000-000000000004';
SELECT is(
  (SELECT count(*) FROM time_entries WHERE id = 'a0000001-0000-0000-0000-000000000004' AND duration_minutes = 999),
  0::bigint,
  'TD1.13: Member cannot UPDATE another member entry'
);

SELECT reset_role();

-- ============= TEST 13: Cross-workspace UPDATE denial =============

SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "66666666-6666-6666-6666-666666666666", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}';

UPDATE time_entries SET duration_minutes = 999 WHERE id = 'a0000001-0000-0000-0000-000000000001';
SELECT is(
  (SELECT count(*) FROM time_entries WHERE id = 'a0000001-0000-0000-0000-000000000001' AND duration_minutes = 999),
  0::bigint,
  'TD1.14: Cross-workspace UPDATE denied'
);

SELECT reset_role();

SELECT * FROM finish();
ROLLBACK;
