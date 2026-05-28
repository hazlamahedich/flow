-- Migration: Add default report template to create_workspace RPC
-- Purpose: Ensure every newly created workspace gets a default report template atomically
-- Related: Story 8-1a — Default Template Seed (AC5)

CREATE OR REPLACE FUNCTION create_workspace(
  p_name text,
  p_slug text,
  p_owner_id uuid
)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  settings jsonb
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO workspaces (name, slug, created_by)
  VALUES (p_name, p_slug, p_owner_id)
  RETURNING id INTO v_id;

  INSERT INTO workspace_members (workspace_id, user_id, role, status)
  VALUES (v_id, p_owner_id, 'owner', 'active');

  -- Seed default report template for new workspace (Story 8-1a AC5)
  INSERT INTO report_templates (workspace_id, client_id, name, sections_config, branding)
  VALUES (
    v_id,
    NULL,
    'Default Weekly Report',
    jsonb_build_object(
      'time_summary', jsonb_build_object('enabled', true, 'sort_order', 1),
      'task_log', jsonb_build_object('enabled', true, 'sort_order', 2),
      'agent_activity', jsonb_build_object('enabled', true, 'sort_order', 3),
      'invoice_summary', jsonb_build_object('enabled', true, 'sort_order', 4)
    ),
    jsonb_build_object('accent_color', '#6366f1', 'logo_url', null)
  );

  RETURN QUERY
    SELECT w.id, w.name, w.slug, w.created_by, w.created_at, w.updated_at, w.settings
    FROM workspaces w
    WHERE w.id = v_id;
END;
$$;
