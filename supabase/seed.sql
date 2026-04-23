-- Seed data for LOCAL DEVELOPMENT ONLY
-- Purpose: 2 test workspaces, 4 roles per workspace, tier config
-- Related: Story 1.2 AC#3, #4, #5
-- Note: Idempotent via ON CONFLICT DO NOTHING. NOT used by CI.

-- ============================================================
-- Test Users (insert into auth.users + public.users)
-- ============================================================

-- Workspace A users
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, encrypted_password, email_confirmed_at)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'owner@flow-a.test', '{"workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "owner"}', '{"full_name": "Alice Owner"}', crypt('password123', gen_salt('bf')), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, encrypted_password, email_confirmed_at)
VALUES
  ('a0000000-0000-0000-0000-000000000002', 'admin@flow-a.test', '{"workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "admin"}', '{"full_name": "Amy Admin"}', crypt('password123', gen_salt('bf')), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, encrypted_password, email_confirmed_at)
VALUES
  ('a0000000-0000-0000-0000-000000000003', 'member@flow-a.test', '{"workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "member"}', '{"full_name": "Mark Member"}', crypt('password123', gen_salt('bf')), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, encrypted_password, email_confirmed_at)
VALUES
  ('a0000000-0000-0000-0000-000000000004', 'client@flow-a.test', '{"workspace_id": "a0000000-0000-0000-0000-000000000001", "role": "client_user"}', '{"full_name": "Claire Client"}', crypt('password123', gen_salt('bf')), now())
ON CONFLICT (id) DO NOTHING;

-- Workspace B users
INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, encrypted_password, email_confirmed_at)
VALUES
  ('b0000000-0000-0000-0000-000000000001', 'owner@flow-b.test', '{"workspace_id": "b0000000-0000-0000-0000-000000000001", "role": "owner"}', '{"full_name": "Bob Owner"}', crypt('password123', gen_salt('bf')), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, encrypted_password, email_confirmed_at)
VALUES
  ('b0000000-0000-0000-0000-000000000002', 'member@flow-b.test', '{"workspace_id": "b0000000-0000-0000-0000-000000000001", "role": "member"}', '{"full_name": "Beth Member"}', crypt('password123', gen_salt('bf')), now())
ON CONFLICT (id) DO NOTHING;

-- Public user profiles
INSERT INTO users (id, email, name, timezone) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'owner@flow-a.test', 'Alice Owner', 'America/New_York'),
  ('a0000000-0000-0000-0000-000000000002', 'admin@flow-a.test', 'Amy Admin', 'America/New_York'),
  ('a0000000-0000-0000-0000-000000000003', 'member@flow-a.test', 'Mark Member', 'America/New_York'),
  ('a0000000-0000-0000-0000-000000000004', 'client@flow-a.test', 'Claire Client', 'America/New_York'),
  ('b0000000-0000-0000-0000-000000000001', 'owner@flow-b.test', 'Bob Owner', 'Europe/London'),
  ('b0000000-0000-0000-0000-000000000002', 'member@flow-b.test', 'Beth Member', 'Europe/London')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- E2E Test Users (owner/admin/member@test.com)
-- ============================================================

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, encrypted_password, email_confirmed_at)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'owner@test.com', '{"workspace_id": "c0000000-0000-0000-0000-000000000001", "role": "owner"}', '{"full_name": "E2E Owner"}', crypt('password123', gen_salt('bf')), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, encrypted_password, email_confirmed_at)
VALUES
  ('c0000000-0000-0000-0000-000000000002', 'admin@test.com', '{"workspace_id": "c0000000-0000-0000-0000-000000000001", "role": "admin"}', '{"full_name": "E2E Admin"}', crypt('password123', gen_salt('bf')), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data, encrypted_password, email_confirmed_at)
VALUES
  ('c0000000-0000-0000-0000-000000000003', 'member@test.com', '{"workspace_id": "c0000000-0000-0000-0000-000000000001", "role": "member"}', '{"full_name": "E2E Member"}', crypt('password123', gen_salt('bf')), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, name, timezone) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'owner@test.com', 'E2E Owner', 'UTC'),
  ('c0000000-0000-0000-0000-000000000002', 'admin@test.com', 'E2E Admin', 'UTC'),
  ('c0000000-0000-0000-0000-000000000003', 'member@test.com', 'E2E Member', 'UTC')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Workspaces
-- ============================================================

INSERT INTO workspaces (id, name, slug, settings) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Flow Agency A', 'flow-agency-a', '{"plan": "agency"}'),
  ('b0000000-0000-0000-0000-000000000001', 'Flow Agency B', 'flow-agency-b', '{"plan": "professional"}'),
  ('c0000000-0000-0000-0000-000000000001', 'E2E Test Workspace', 'e2e-test-workspace', '{"plan": "agency"}')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Workspace Members
-- ============================================================

INSERT INTO workspace_members (workspace_id, user_id, role) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'owner'),
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'admin'),
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'member'),
  ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'client_user'),
  ('b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'owner'),
  ('b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', 'member'),
  ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'owner'),
  ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'admin'),
  ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'member')
ON CONFLICT DO NOTHING;
