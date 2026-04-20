-- Migration: users table
-- Purpose: User profile with FK to auth.users (FR9)
-- Related: Story 1.2 AC#4
-- Note: NOT workspace-scoped. Users exist across workspaces.

CREATE TABLE users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  name text,
  timezone text NOT NULL DEFAULT 'UTC',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY policy_users_select_self ON users
  FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY policy_users_update_self ON users
  FOR UPDATE
  USING (auth.uid() = id);

CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime('updated_at');
