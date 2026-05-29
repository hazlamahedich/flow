-- Migration: Fix create_weekly_report_with_sections to set version_group_id
-- Date: 2026-05-29

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

  -- Enforce version grouping
  UPDATE weekly_reports
  SET version_group_id = v_report_id
  WHERE id = v_report_id;

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
