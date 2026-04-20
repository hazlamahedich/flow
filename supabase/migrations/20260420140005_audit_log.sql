-- Migration: audit_log table
-- Purpose: Append-only audit trail with tenant isolation and hash chain
-- Related: Story 1.2 AC#7, AC#10
-- Note: Workspace-scoped. Append-only (no UPDATE/DELETE enforced by trigger).
-- Hash chain provides tamper detection per-tenant.

CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  previous_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_audit_log_workspace_created
  ON audit_log (workspace_id, created_at);

CREATE INDEX idx_audit_log_workspace_id
  ON audit_log (workspace_id);

CREATE OR REPLACE FUNCTION enforce_audit_append_only()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'audit_log is append-only: UPDATE not permitted';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'audit_log is append-only: DELETE not permitted';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_append_only
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION enforce_audit_append_only();
