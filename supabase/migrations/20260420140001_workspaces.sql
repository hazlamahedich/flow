-- Migration: workspaces table
-- Purpose: Core tenant/workspace table for multi-tenant isolation (FR91)
-- Related: Story 1.2 AC#3

CREATE EXTENSION IF NOT EXISTS moddatetime SCHEMA extensions;

CREATE TABLE workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  settings jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_workspaces_id ON workspaces (id);

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON workspaces
  FOR EACH ROW
  EXECUTE FUNCTION extensions.moddatetime('updated_at');
