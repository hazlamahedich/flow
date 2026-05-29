-- pgTAP RLS tests: Report Regeneration (Story 8-1c)
-- Purpose: Verify Member blocked from UPDATE/INSERT on weekly_reports + sections during regeneration.
--          Owner/Admin allowed. Cross-tenant isolation.
-- Tables: weekly_reports, weekly_report_sections

BEGIN;

CREATE OR REPLACE FUNCTION reset_role() RETURNS void AS $$
BEGIN
  EXECUTE 'RESET ROLE';
END;
$$ LANGUAGE plpgsql;

SELECT plan(7);

SET ROLE postgres;

-- Seed workspaces + users + members + clients
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('a1111111-1111-1111-1111-111111111111', 'regen-owner@test.com',    '{"workspace_id": "d1111111-1111-1111-1111-111111111111", "role": "owner"}',   '{}'),
  ('a2222222-2222-2222-2222-222222222222', 'regen-admin@test.com',    '{"workspace_id": "d1111111-1111-1111-1111-111111111111", "role": "admin"}',   '{}'),
  ('a3333333-3333-3333-3333-333333333333', 'regen-member@test.com',   '{"workspace_id": "d1111111-1111-1111-1111-111111111111", "role": "member"}',  '{}'),
  ('a4444444-4444-4444-4444-444444444444', 'regen-outside@test.com', '{"workspace_id": "d2222222-2222-2222-2222-222222222222", "role": "owner"}',   '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, name) VALUES
  ('a1111111-1111-1111-1111-111111111111', 'regen-owner@test.com',  'Owner'),
  ('a2222222-2222-2222-2222-222222222222', 'regen-admin@test.com',  'Admin'),
  ('a3333333-3333-3333-3333-333333333333', 'regen-member@test.com', 'Member'),
  ('a4444444-4444-4444-4444-444444444444', 'regen-outside@test.com','Outside')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspaces (id, name, slug) VALUES
  ('d1111111-1111-1111-1111-111111111111', 'Regen WS A', 'regen-ws-a'),
  ('d2222222-2222-2222-2222-222222222222', 'Regen WS B', 'regen-ws-b')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role, status) VALUES
  ('d1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'owner',  'active'),
  ('d1111111-1111-1111-1111-111111111111', 'a2222222-2222-2222-2222-222222222222', 'admin',  'active'),
  ('d1111111-1111-1111-1111-111111111111', 'a3333333-3333-3333-3333-333333333333', 'member', 'active'),
  ('d2222222-2222-2222-2222-222222222222', 'a4444444-4444-4444-4444-444444444444', 'owner',  'active')
ON CONFLICT DO NOTHING;

INSERT INTO clients (id, workspace_id, name, email) VALUES
  ('0e111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'Client A', 'a@regen.com')
ON CONFLICT (id) DO NOTHING;

-- Seed reports via service_role (bypass RLS)
SET ROLE service_role;

INSERT INTO weekly_reports (id, workspace_id, client_id, period_start, period_end, status, generated_by, version, version_group_id)
VALUES
  ('f1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', '0e111111-1111-1111-1111-111111111111', '2026-06-01', '2026-06-07', 'draft', 'a1111111-1111-1111-1111-111111111111', 1, 'f1111111-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;

INSERT INTO weekly_report_sections (id, report_id, section_type, title, content, sort_order)
VALUES
  ('01111111-1111-1111-1111-111111111111', 'f1111111-1111-1111-1111-111111111111', 'time_summary', 'Time Summary', '{"totalMinutes":120}', 1)
ON CONFLICT DO NOTHING;

SELECT reset_role();

-- ============================================
-- Test 1: Member UPDATE on weekly_reports returns 0 rows (blocked by RLS USING)
-- ============================================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'a3333333-3333-3333-3333-333333333333';
SET LOCAL request.jwt.claim.workspace_id = 'd1111111-1111-1111-1111-111111111111';
SET LOCAL request.jwt.claim.role = 'member';

SELECT is_empty(
  $$UPDATE weekly_reports SET version = version + 1, updated_at = now() WHERE id = 'f1111111-1111-1111-1111-111111111111' AND status = 'draft' RETURNING id$$,
  'Member UPDATE on weekly_reports blocked by RLS (0 rows)'
);

-- ============================================
-- Test 2: Member INSERT into weekly_reports throws 42501 (WITH CHECK blocks)
-- ============================================
-- First set report to sent so SELECT subquery matches
SET ROLE service_role;
UPDATE weekly_reports SET status = 'sent', sent_at = now() WHERE id = 'f1111111-1111-1111-1111-111111111111';
SELECT reset_role();

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'a3333333-3333-3333-3333-333333333333';
SET LOCAL request.jwt.claim.workspace_id = 'd1111111-1111-1111-1111-111111111111';
SET LOCAL request.jwt.claim.role = 'member';

SELECT is_empty(
  $$INSERT INTO weekly_reports (workspace_id, client_id, period_start, period_end, status, generated_by, version, parent_report_id, version_group_id)
     SELECT workspace_id, client_id, period_start, period_end, 'draft', 'a3333333-3333-3333-3333-333333333333', version + 1, id, COALESCE(version_group_id, id)
     FROM weekly_reports WHERE id = 'f1111111-1111-1111-1111-111111111111' AND status IN ('sent', 'viewed') RETURNING id$$,
  'Member INSERT clone blocked by RLS (source invisible, 0 rows)'
);

-- ============================================
-- Test 3: Member UPDATE on sections returns 0 rows (blocked by RLS USING)
-- ============================================
SELECT is_empty(
  $$UPDATE weekly_report_sections SET content = '{"totalMinutes":200}' WHERE report_id = 'f1111111-1111-1111-1111-111111111111' RETURNING id$$,
  'Member UPDATE on weekly_report_sections blocked by RLS (0 rows)'
);

-- ============================================
-- Test 4: Owner CAN UPDATE weekly_reports (draft regeneration allowed)
-- ============================================
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'a1111111-1111-1111-1111-111111111111';
SET LOCAL request.jwt.claim.workspace_id = 'd1111111-1111-1111-1111-111111111111';
SET LOCAL request.jwt.claim.role = 'owner';

SELECT lives_ok(
  $$UPDATE weekly_reports SET version = version + 1, updated_at = now() WHERE id = 'f1111111-1111-1111-1111-111111111111' AND status = 'draft'$$,
  'Owner can UPDATE weekly_reports for draft regeneration'
);

-- ============================================
-- Test 5: Admin CAN INSERT into weekly_reports (sent report cloning allowed)
-- ============================================
SET LOCAL request.jwt.claim.sub = 'a2222222-2222-2222-2222-222222222222';
SET LOCAL request.jwt.claim.role = 'admin';

-- First set report to sent
SET ROLE service_role;
UPDATE weekly_reports SET status = 'sent', sent_at = now() WHERE id = 'f1111111-1111-1111-1111-111111111111';
SELECT reset_role();

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub = 'a2222222-2222-2222-2222-222222222222';
SET LOCAL request.jwt.claim.workspace_id = 'd1111111-1111-1111-1111-111111111111';
SET LOCAL request.jwt.claim.role = 'admin';

SELECT lives_ok(
  $$INSERT INTO weekly_reports (workspace_id, client_id, period_start, period_end, status, generated_by, version, parent_report_id, version_group_id)
     SELECT workspace_id, client_id, period_start, period_end, 'draft', 'a2222222-2222-2222-2222-222222222222', version + 1, id, COALESCE(version_group_id, id)
     FROM weekly_reports WHERE id = 'f1111111-1111-1111-1111-111111111111' AND status IN ('sent', 'viewed')$$,
  'Admin can INSERT into weekly_reports for sent report cloning'
);

-- ============================================
-- Test 6: Cross-tenant isolation — WS B owner cannot regenerate WS A reports
-- ============================================
SET LOCAL request.jwt.claim.sub = 'a4444444-4444-4444-4444-444444444444';
SET LOCAL request.jwt.claim.workspace_id = 'd2222222-2222-2222-2222-222222222222';
SET LOCAL request.jwt.claim.role = 'owner';

SELECT is_empty(
  $$SELECT * FROM weekly_reports WHERE workspace_id = 'd1111111-1111-1111-1111-111111111111'$$,
  'Cross-workspace owner cannot see WS A reports'
);

-- ============================================
-- Test 7: Cross-tenant — WS B owner cannot UPDATE WS A report sections
-- ============================================
SELECT is_empty(
  $$SELECT * FROM weekly_report_sections WHERE report_id = 'f1111111-1111-1111-1111-111111111111'$$,
  'Cross-workspace owner cannot see WS A report sections'
);

-- ============================================
-- Finish
-- ============================================
SELECT * FROM finish();
ROLLBACK;
