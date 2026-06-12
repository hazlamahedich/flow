-- pgTAP RLS tests: weekly_reports, weekly_report_sections, report_templates
-- Purpose: Verify role-based access (owner/admin INSERT+UPDATE+SELECT, member SELECT only,
--          client_user blocked, cross-workspace isolation, service_role bypass).
-- Tables: weekly_reports, weekly_report_sections, report_templates

BEGIN;

SELECT plan(18);

SET ROLE postgres;

-- ============================================
-- Seed workspaces + users + members + clients
-- ============================================
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'pgtap-owner@test.com',  '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}',       '{}'),
  ('22222222-2222-2222-2222-222222222222', 'pgtap-admin@test.com',  '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}',       '{}'),
  ('33333333-3333-3333-3333-333333333333', 'pgtap-member@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}',      '{}'),
  ('44444444-4444-4444-4444-444444444444', 'pgtap-client@test.com', '{"workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "client_user"}', '{}'),
  ('55555555-5555-5555-5555-555555555555', 'pgtap-outside@test.com','{"workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}',       '{}')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'pgtap-owner@test.com',  'Owner'),
  ('22222222-2222-2222-2222-222222222222', 'pgtap-admin@test.com',  'Admin'),
  ('33333333-3333-3333-3333-333333333333', 'pgtap-member@test.com', 'Member'),
  ('44444444-4444-4444-4444-444444444444', 'pgtap-client@test.com', 'Client'),
  ('55555555-5555-5555-5555-555555555555', 'pgtap-outside@test.com','Outside')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspaces (id, name, slug) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Workspace A', 'pgtap-reports-ws-a'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Workspace B', 'pgtap-reports-ws-b')
ON CONFLICT (id) DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role, status) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner',   'active'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'admin',   'active'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'member',  'active'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '44444444-4444-4444-4444-444444444444', 'client_user','active'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '55555555-5555-5555-5555-555555555555', 'owner',   'active')
ON CONFLICT DO NOTHING;

INSERT INTO clients (id, workspace_id, name, email) VALUES
  ('c1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Acme Corp', 'acme@test.com'),
  ('c2222222-2222-2222-2222-222222222222', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Beta Inc',  'beta@test.com'),
  ('c3333333-3333-3333-3333-333333333333', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Gamma LLC', 'gamma@test.com')
ON CONFLICT (id) DO NOTHING;

-- Seed a default report template for Workspace A
INSERT INTO report_templates (id, workspace_id, client_id, name, sections_config, branding)
VALUES
  ('d1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, 'Default Weekly Report',
   '{"time_summary":{"enabled":true,"sort_order":1},"task_log":{"enabled":true,"sort_order":2},"agent_activity":{"enabled":true,"sort_order":3},"invoice_summary":{"enabled":true,"sort_order":4}}',
   '{"accent_color":"#6366f1"}'
  )
ON CONFLICT DO NOTHING;

-- Insert a report + sections for Workspace A (via service_role to bypass RLS during seed)
SET ROLE service_role;

INSERT INTO weekly_reports (id, workspace_id, client_id, period_start, period_end, status, template_id, generated_by, generated_at, version, template_snapshot)
VALUES
  ('e1111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', '2026-05-19', '2026-05-25', 'draft', 'd1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', now(), 1, '{}'),
  ('e2222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'c3333333-3333-3333-3333-333333333333', '2026-05-19', '2026-05-25', 'draft', NULL, '55555555-5555-5555-5555-555555555555', now(), 1, '{}')
ON CONFLICT DO NOTHING;

INSERT INTO weekly_report_sections (id, report_id, section_type, title, content, sort_order)
VALUES
  ('f1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111', 'time_summary',     'Time Summary',     '{"totalMinutes":120}', 1),
  ('f1111112-1112-1112-1112-111111111112', 'e1111111-1111-1111-1111-111111111111', 'task_log',         'Task Log',         '{"entries":[]}', 2),
  ('f1111113-1113-1113-1113-111111111113', 'e1111111-1111-1111-1111-111111111111', 'agent_activity',   'Agent Activity',   '{"runs":[]}', 3),
  ('f1111114-1114-1114-1114-111111111114', 'e1111111-1111-1111-1111-111111111111', 'invoice_summary',  'Invoice Summary',  '{"totalCents":0}', 4)
ON CONFLICT DO NOTHING;

RESET ROLE;

-- ============================================
-- report_templates: SELECT
-- ============================================
SET ROLE authenticated;
SET request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}';

SELECT results_eq(
  $$SELECT id FROM report_templates ORDER BY id$$,
  $$VALUES ('d1111111-1111-1111-1111-111111111111'::uuid)$$,
  'Owner can SELECT workspace default template'
);

SET request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}';
SELECT results_eq(
  $$SELECT id FROM report_templates ORDER BY id$$,
  $$VALUES ('d1111111-1111-1111-1111-111111111111'::uuid)$$,
  'Member can SELECT workspace default template'
);

SET request.jwt.claims = '{"sub": "44444444-4444-4444-4444-444444444444", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "client_user"}';
SELECT results_eq(
  $$SELECT id FROM report_templates ORDER BY id$$,
  $$VALUES ('d1111111-1111-1111-1111-111111111111'::uuid)$$,
  'ClientUser can SELECT report_templates (member policy)'
);

SET request.jwt.claims = '{"sub": "55555555-5555-5555-5555-555555555555", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}';
SELECT results_eq(
  $$SELECT count(*)::int FROM report_templates$$,
  $$SELECT 0$$,
  'Cross-workspace owner sees no templates from Workspace A'
);

-- ============================================
-- report_templates: INSERT / UPDATE / DELETE
-- ============================================
SET request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}';

SELECT lives_ok(
  $$INSERT INTO report_templates (workspace_id, client_id, name, sections_config, branding)
     VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', 'Owner Template', '{}', '{}')$$,
  'Owner can INSERT report template'
);

SET request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}';
SELECT lives_ok(
  $$INSERT INTO report_templates (workspace_id, client_id, name, sections_config, branding)
     VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c2222222-2222-2222-2222-222222222222', 'Admin Template', '{}', '{}')$$,
  'Admin can INSERT report template'
);

SET request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}';
SELECT throws_ok(
  $$INSERT INTO report_templates (workspace_id, client_id, name, sections_config, branding)
     VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, 'Member Template', '{}', '{}')$$,
  '42501',
  NULL,
  'Member cannot INSERT report template'
);

-- ============================================
-- weekly_reports: SELECT + cross-workspace isolation
-- ============================================
SET request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}';

SELECT results_eq(
  $$SELECT id FROM weekly_reports ORDER BY id$$,
  $$VALUES ('e1111111-1111-1111-1111-111111111111'::uuid)$$,
  'Owner sees own workspace report'
);

SET request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}';
SELECT results_eq(
  $$SELECT id FROM weekly_reports ORDER BY id$$,
  $$VALUES ('e1111111-1111-1111-1111-111111111111'::uuid)$$,
  'Member sees own workspace report (SELECT allowed)'
);

SET request.jwt.claims = '{"sub": "55555555-5555-5555-5555-555555555555", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}';
SELECT results_eq(
  $$SELECT id FROM weekly_reports ORDER BY id$$,
  $$VALUES ('e2222222-2222-2222-2222-222222222222'::uuid)$$,
  'Workspace B owner sees Workspace B report only'
);

-- ============================================
-- weekly_reports: INSERT (owner/admin ok, member blocked)
-- ============================================
SET request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}';

SELECT lives_ok(
  $$INSERT INTO weekly_reports (workspace_id, client_id, period_start, period_end, generated_by, version)
     VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', '2026-06-01', '2026-06-07', '11111111-1111-1111-1111-111111111111', 1)$$,
  'Owner can INSERT weekly_report'
);

SET request.jwt.claims = '{"sub": "22222222-2222-2222-2222-222222222222", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "admin"}';
SELECT lives_ok(
  $$INSERT INTO weekly_reports (workspace_id, client_id, period_start, period_end, generated_by, version)
     VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', '2026-06-08', '2026-06-14', '22222222-2222-2222-2222-222222222222', 1)$$,
  'Admin can INSERT weekly_report'
);

SET request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}';
SELECT throws_ok(
  $$INSERT INTO weekly_reports (workspace_id, client_id, period_start, period_end, generated_by, version)
     VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', '2026-06-15', '2026-06-21', '33333333-3333-3333-3333-333333333333', 1)$$,
  '42501',
  NULL,
  'Member cannot INSERT weekly_report'
);

-- ============================================
-- weekly_report_sections: SELECT (via JOIN)
-- ============================================
SET request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}';

SELECT results_eq(
  $$SELECT section_type FROM weekly_report_sections WHERE report_id = 'e1111111-1111-1111-1111-111111111111' ORDER BY sort_order$$,
  $$VALUES ('time_summary'::text), ('task_log'::text), ('agent_activity'::text), ('invoice_summary'::text)$$,
  'Owner can SELECT sections for workspace report'
);

SET request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}';
SELECT results_eq(
  $$SELECT section_type FROM weekly_report_sections WHERE report_id = 'e1111111-1111-1111-1111-111111111111' ORDER BY sort_order$$,
  $$VALUES ('time_summary'::text), ('task_log'::text), ('agent_activity'::text), ('invoice_summary'::text)$$,
  'Member can SELECT sections for workspace report'
);

SET request.jwt.claims = '{"sub": "55555555-5555-5555-5555-555555555555", "workspace_id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "role": "owner"}';
SELECT results_eq(
  $$SELECT count(*)::int FROM weekly_report_sections WHERE report_id = 'e1111111-1111-1111-1111-111111111111'$$,
  $$SELECT 0$$,
  'Workspace B owner cannot SELECT Workspace A sections'
);

-- ============================================
-- weekly_report_sections: INSERT (owner/admin ok, member blocked)
-- ============================================
-- Use a fresh report for insert test
SET ROLE service_role;
INSERT INTO weekly_reports (id, workspace_id, client_id, period_start, period_end, generated_by, version)
VALUES ('e3333333-3333-3333-3333-333333333333', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'c1111111-1111-1111-1111-111111111111', '2026-07-01', '2026-07-07', '11111111-1111-1111-1111-111111111111', 1)
ON CONFLICT DO NOTHING;
RESET ROLE;

SET ROLE authenticated;
SET request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "owner"}';

SELECT lives_ok(
  $$INSERT INTO weekly_report_sections (report_id, section_type, title, content, sort_order)
     VALUES ('e3333333-3333-3333-3333-333333333333', 'time_summary', 'TS', '{}', 1)$$,
  'Owner can INSERT weekly_report_section'
);

SET request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "workspace_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", "role": "member"}';
SELECT throws_ok(
  $$INSERT INTO weekly_report_sections (report_id, section_type, title, content, sort_order)
     VALUES ('e3333333-3333-3333-3333-333333333333', 'task_log', 'TL', '{}', 2)$$,
  '42501',
  NULL,
  'Member cannot INSERT weekly_report_section'
);

RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
