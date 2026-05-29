-- Migration: Weekly Reports Foundation (Epic 8, Story 8-1a)
-- Purpose: weekly_reports, weekly_report_sections, report_templates tables + RLS
-- Pattern: workspace_id::text = auth.jwt()->>'workspace_id' (canonical RLS)
-- Note: `version` and `parent_report_id` added here to support Story 8-1c (regeneration/versioning)

-- ============================================
-- report_templates (must exist before weekly_reports FK)
-- ============================================
CREATE TABLE report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sections_config JSONB NOT NULL DEFAULT '{}',
  branding JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial unique: one workspace default per workspace
CREATE UNIQUE INDEX idx_report_templates_workspace_default
  ON report_templates (workspace_id)
  WHERE client_id IS NULL;

-- Per-client template: allow multiple if client_id is different
CREATE INDEX idx_report_templates_workspace_client
  ON report_templates (workspace_id, client_id);

-- ============================================
-- weekly_reports
-- ============================================
CREATE TABLE weekly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'viewed', 'approved')),
  template_id UUID REFERENCES report_templates(id) ON DELETE SET NULL,
  generated_by UUID NOT NULL REFERENCES users(id),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  version INT NOT NULL DEFAULT 1,
  parent_report_id UUID REFERENCES weekly_reports(id) ON DELETE SET NULL,
  template_snapshot JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Business constraints
  CONSTRAINT period_start_before_end CHECK (period_start <= period_end)
);

-- High-selectivity index for list queries (report listing)
CREATE INDEX idx_weekly_reports_workspace_client_generated
  ON weekly_reports (workspace_id, client_id, generated_at DESC);

-- Partial index for draft reports (common filter in dashboards)
CREATE INDEX idx_weekly_reports_workspace_draft
  ON weekly_reports (workspace_id)
  WHERE status = 'draft';

-- Parent-child relationship for versioning lookups
CREATE INDEX idx_weekly_reports_parent_id
  ON weekly_reports (parent_report_id)
  WHERE parent_report_id IS NOT NULL;

-- ============================================
-- weekly_report_sections
-- ============================================
CREATE TABLE weekly_report_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES weekly_reports(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL
    CHECK (section_type IN ('time_summary', 'task_log', 'agent_activity', 'invoice_summary')),
  title TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- CRITICAL: enables ON CONFLICT (report_id, section_type) for regeneration
  UNIQUE (report_id, section_type)
);

CREATE INDEX idx_weekly_report_sections_report_sort
  ON weekly_report_sections (report_id, sort_order);

-- ============================================
-- Atomic RPC: create_weekly_report_with_sections
-- Ensures header + sections are inserted in a single transaction.
-- Called by generateWeeklyReportAction to guarantee atomicity.
-- ============================================
CREATE OR REPLACE FUNCTION create_weekly_report_with_sections(
  p_workspace_id UUID,
  p_client_id UUID,
  p_period_start DATE,
  p_period_end DATE,
  p_template_id UUID,
  p_generated_by UUID,
  p_template_snapshot JSONB,
  p_sections JSONB
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_report_id UUID;
  v_section JSONB;
  v_sort_order INT := 0;
BEGIN
  INSERT INTO weekly_reports (
    workspace_id, client_id, period_start, period_end, status,
    template_id, generated_by, template_snapshot
  )
  VALUES (
    p_workspace_id, p_client_id, p_period_start, p_period_end, 'draft',
    p_template_id, p_generated_by, p_template_snapshot
  )
  RETURNING id INTO v_report_id;

  FOR v_section IN SELECT * FROM jsonb_array_elements(p_sections)
  LOOP
    v_sort_order := v_sort_order + 1;
    INSERT INTO weekly_report_sections (report_id, section_type, title, content, sort_order)
    VALUES (
      v_report_id,
      v_section->>'section_type',
      v_section->>'title',
      COALESCE(v_section->'content', '{}'),
      v_sort_order
    );
  END LOOP;

  RETURN v_report_id;
END;
$$;

-- ============================================
-- Atomic RPC: update_weekly_report_sections (for draft re-generation)
-- Deletes existing sections and re-inserts. Atomic. Optimistic lock on updated_at.
-- ============================================
CREATE OR REPLACE FUNCTION update_weekly_report_sections(
  p_report_id UUID,
  p_updated_at TIMESTAMPTZ,
  p_sections JSONB
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_report_workspace_id UUID;
  v_report_client_id UUID;
  v_report_updated_at TIMESTAMPTZ;
  v_section JSONB;
  v_sort_order INT := 0;
BEGIN
  -- Optimistic lock: fail if row was modified since last read
  SELECT workspace_id, client_id, updated_at
  INTO v_report_workspace_id, v_report_client_id, v_report_updated_at
  FROM weekly_reports
  WHERE id = p_report_id AND updated_at = p_updated_at FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONCURRENT_MODIFICATION: report has been modified by another process';
  END IF;

  -- Delete existing sections
  DELETE FROM weekly_report_sections WHERE report_id = p_report_id;

  -- Re-insert new sections
  FOR v_section IN SELECT * FROM jsonb_array_elements(p_sections)
  LOOP
    v_sort_order := v_sort_order + 1;
    INSERT INTO weekly_report_sections (report_id, section_type, title, content, sort_order)
    VALUES (
      p_report_id,
      v_section->>'section_type',
      v_section->>'title',
      COALESCE(v_section->'content', '{}'),
      v_sort_order
    );
  END LOOP;

  -- Bump updated_at
  UPDATE weekly_reports
  SET updated_at = now()
  WHERE id = p_report_id;

  RETURN p_report_id;
END;
$$;

-- ============================================
-- RLS: report_templates
-- ============================================
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY policy_report_templates_select_member
  ON report_templates FOR SELECT
  TO authenticated
  USING (workspace_id::text IN (
    SELECT wm.workspace_id::text FROM workspace_members wm
    WHERE wm.user_id = auth.uid() AND wm.status = 'active'
  ));

CREATE POLICY policy_report_templates_insert_owner_admin
  ON report_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id::text IN (
      SELECT wm.workspace_id::text FROM workspace_members wm
      WHERE wm.user_id = auth.uid() AND wm.status = 'active' AND wm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY policy_report_templates_update_owner_admin
  ON report_templates FOR UPDATE
  TO authenticated
  USING (workspace_id::text IN (
    SELECT wm.workspace_id::text FROM workspace_members wm
    WHERE wm.user_id = auth.uid() AND wm.status = 'active' AND wm.role IN ('owner', 'admin')
  ))
  WITH CHECK (workspace_id::text IN (
    SELECT wm.workspace_id::text FROM workspace_members wm
    WHERE wm.user_id = auth.uid() AND wm.status = 'active' AND wm.role IN ('owner', 'admin')
  ));

CREATE POLICY policy_report_templates_delete_owner_admin
  ON report_templates FOR DELETE
  TO authenticated
  USING (workspace_id::text IN (
    SELECT wm.workspace_id::text FROM workspace_members wm
    WHERE wm.user_id = auth.uid() AND wm.status = 'active' AND wm.role IN ('owner', 'admin')
  ));

CREATE POLICY policy_report_templates_service_role
  ON report_templates TO service_role
  USING (true) WITH CHECK (true);

-- ============================================
-- RLS: weekly_reports
-- ============================================
ALTER TABLE weekly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY policy_weekly_reports_select_member
  ON weekly_reports FOR SELECT
  TO authenticated
  USING (workspace_id::text IN (
    SELECT wm.workspace_id::text FROM workspace_members wm
    WHERE wm.user_id = auth.uid() AND wm.status = 'active'
  ));

CREATE POLICY policy_weekly_reports_insert_owner_admin
  ON weekly_reports FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id::text IN (
      SELECT wm.workspace_id::text FROM workspace_members wm
      WHERE wm.user_id = auth.uid() AND wm.status = 'active' AND wm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY policy_weekly_reports_update_owner_admin
  ON weekly_reports FOR UPDATE
  TO authenticated
  USING (workspace_id::text IN (
    SELECT wm.workspace_id::text FROM workspace_members wm
    WHERE wm.user_id = auth.uid() AND wm.status = 'active' AND wm.role IN ('owner', 'admin')
  ))
  WITH CHECK (workspace_id::text IN (
    SELECT wm.workspace_id::text FROM workspace_members wm
    WHERE wm.user_id = auth.uid() AND wm.status = 'active' AND wm.role IN ('owner', 'admin')
  ));

-- Member can update nothing on weekly_reports (SELECT only)
-- No DELETE policy: reports are immutable once sent; drafts can be soft-archived if needed later

CREATE POLICY policy_weekly_reports_service_role
  ON weekly_reports TO service_role
  USING (true) WITH CHECK (true);

-- ============================================
-- RLS: weekly_report_sections
-- Inherits workspace scoping via JOIN to weekly_reports
-- ============================================
ALTER TABLE weekly_report_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY policy_weekly_report_sections_select_member
  ON weekly_report_sections FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM weekly_reports wr
    JOIN workspace_members wm ON wm.workspace_id = wr.workspace_id
    WHERE wr.id = weekly_report_sections.report_id
      AND wm.user_id = auth.uid()
      AND wm.status = 'active'
  ));

CREATE POLICY policy_weekly_report_sections_insert_owner_admin
  ON weekly_report_sections FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM weekly_reports wr
    JOIN workspace_members wm ON wm.workspace_id = wr.workspace_id
    WHERE wr.id = weekly_report_sections.report_id
      AND wm.user_id = auth.uid()
      AND wm.status = 'active'
      AND wm.role IN ('owner', 'admin')
  ));

CREATE POLICY policy_weekly_report_sections_update_owner_admin
  ON weekly_report_sections FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM weekly_reports wr
    JOIN workspace_members wm ON wm.workspace_id = wr.workspace_id
    WHERE wr.id = weekly_report_sections.report_id
      AND wm.user_id = auth.uid()
      AND wm.status = 'active'
      AND wm.role IN ('owner', 'admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM weekly_reports wr
    JOIN workspace_members wm ON wm.workspace_id = wr.workspace_id
    WHERE wr.id = weekly_report_sections.report_id
      AND wm.user_id = auth.uid()
      AND wm.status = 'active'
      AND wm.role IN ('owner', 'admin')
  ));

-- No DELETE policy needed: sections cascade with report deletion

CREATE POLICY policy_weekly_report_sections_service_role
  ON weekly_report_sections TO service_role
  USING (true) WITH CHECK (true);

-- ============================================
-- Default template seed for existing workspaces
-- Run after migration to ensure every workspace has a default template
-- ============================================
INSERT INTO report_templates (workspace_id, client_id, name, sections_config, branding)
SELECT
  w.id AS workspace_id,
  NULL AS client_id,
  'Default Weekly Report' AS name,
  jsonb_build_object(
    'time_summary', jsonb_build_object('enabled', true, 'sort_order', 1),
    'task_log', jsonb_build_object('enabled', true, 'sort_order', 2),
    'agent_activity', jsonb_build_object('enabled', true, 'sort_order', 3),
    'invoice_summary', jsonb_build_object('enabled', true, 'sort_order', 4)
  ) AS sections_config,
  jsonb_build_object('accentColor', '#6366f1', 'logoUrl', null) AS branding
FROM workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM report_templates rt
  WHERE rt.workspace_id = w.id AND rt.client_id IS NULL
);
