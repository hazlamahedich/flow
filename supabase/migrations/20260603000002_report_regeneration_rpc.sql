-- Story 8-1c: Regeneration RPC functions
-- draft regeneration: conditional-write UPDATE + upsert sections
-- sent report cloning: conditional-write INSERT + copy sections

-- ============================================
-- RPC: regenerate_draft_report
-- Conditional-write on version + status = 'draft'
-- Upserts sections by (report_id, section_type)
-- ============================================
CREATE OR REPLACE FUNCTION regenerate_draft_report(
  p_report_id UUID,
  p_expected_version INT,
  p_generated_by UUID,
  p_sections JSONB
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated_id UUID;
  v_section JSONB;
  v_sort_order INT := 0;
BEGIN
  -- Conditional-write: only succeeds if version and status match
  UPDATE weekly_reports
  SET version = version + 1,
      updated_at = now(),
      generated_at = now(),
      generated_by = p_generated_by
  WHERE id = p_report_id
    AND version = p_expected_version
    AND status = 'draft'
  RETURNING id INTO v_updated_id;

  IF v_updated_id IS NULL THEN
    -- Check if report exists at all
    IF NOT EXISTS (SELECT 1 FROM weekly_reports WHERE id = p_report_id) THEN
      RAISE EXCEPTION 'NOT_FOUND: report does not exist';
    END IF;
    RAISE EXCEPTION 'CONCURRENT_MODIFICATION: version mismatch or status changed';
  END IF;

  -- Upsert sections
  FOR v_section IN SELECT * FROM jsonb_array_elements(COALESCE(p_sections, '[]'::jsonb))
  LOOP
    v_sort_order := v_sort_order + 1;
    INSERT INTO weekly_report_sections (report_id, section_type, title, content, sort_order)
    VALUES (
      v_updated_id,
      v_section->>'section_type',
      v_section->>'title',
      COALESCE(v_section->'content', '{}'),
      v_sort_order
    )
    ON CONFLICT (report_id, section_type)
    DO UPDATE SET
      title = EXCLUDED.title,
      content = EXCLUDED.content,
      sort_order = EXCLUDED.sort_order;
  END LOOP;

  -- Delete omitted sections
  DELETE FROM weekly_report_sections
  WHERE report_id = v_updated_id
    AND section_type NOT IN (
      SELECT jsonb_array_elements(COALESCE(p_sections, '[]'::jsonb))->>'section_type'
    );

  RETURN v_updated_id;
END;
$$;

-- ============================================
-- RPC: clone_sent_report
-- Conditional-write INSERT only if status in ('sent', 'viewed')
-- Sets version_group_id on original if first clone
-- ============================================
CREATE OR REPLACE FUNCTION clone_sent_report(
  p_report_id UUID,
  p_generated_by UUID,
  p_template_snapshot JSONB,
  p_sections JSONB
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_id UUID;
  v_version_group_id UUID;
  v_section JSONB;
  v_sort_order INT := 0;
  v_original_sections JSONB;
BEGIN
  -- Check if report exists
  IF NOT EXISTS (SELECT 1 FROM weekly_reports WHERE id = p_report_id) THEN
    RAISE EXCEPTION 'NOT_FOUND: report does not exist';
  END IF;

  -- Clone via conditional-write INSERT
  INSERT INTO weekly_reports (
    workspace_id, client_id, period_start, period_end,
    status, template_id, generated_by, generated_at,
    version, parent_report_id, version_group_id, template_snapshot
  )
  SELECT
    orig.workspace_id, orig.client_id, orig.period_start, orig.period_end,
    'draft', orig.template_id, p_generated_by, now(),
    orig.version + 1, orig.id,
    COALESCE(orig.version_group_id, orig.id),
    p_template_snapshot
  FROM weekly_reports orig
  WHERE orig.id = p_report_id
    AND orig.status IN ('sent', 'viewed')
  RETURNING id INTO v_new_id;

  IF v_new_id IS NULL THEN
    RAISE EXCEPTION 'CONCURRENT_MODIFICATION: report is not in sent/viewed status';
  END IF;

  -- Set version_group_id on original if it was NULL (first clone)
  UPDATE weekly_reports
  SET version_group_id = id
  WHERE id = p_report_id AND version_group_id IS NULL;

  -- Copy sections from original
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'section_type', s.section_type,
      'title', s.title,
      'content', s.content,
      'sort_order', s.sort_order
    )
    ORDER BY s.sort_order
  ), '[]')
  INTO v_original_sections
  FROM weekly_report_sections s
  WHERE s.report_id = p_report_id;

  -- Insert new sections for the clone
  FOR v_section IN SELECT * FROM jsonb_array_elements(
    CASE WHEN p_sections IS NOT NULL AND jsonb_array_length(p_sections) > 0
         THEN p_sections
         ELSE v_original_sections
    END
  )
  LOOP
    v_sort_order := v_sort_order + 1;
    INSERT INTO weekly_report_sections (report_id, section_type, title, content, sort_order)
    VALUES (
      v_new_id,
      v_section->>'section_type',
      v_section->>'title',
      COALESCE(v_section->'content', '{}'),
      v_sort_order
    );
  END LOOP;

  RETURN v_new_id;
END;
$$;
