-- Migration: Create get_scope_creep_alerts SQL function
-- Purpose: Replace N+1 JS fallback with single CTE query for scope creep detection
-- Addresses: DW-3.2-1

CREATE OR REPLACE FUNCTION get_scope_creep_alerts(p_workspace_id uuid)
RETURNS TABLE (
  retainer_id uuid,
  client_id uuid,
  client_name text,
  retainer_type text,
  tracked_minutes bigint,
  threshold_minutes numeric,
  utilization_percent bigint
)
LANGUAGE sql
STABLE
AS $$
WITH active_retainers AS (
  SELECT
    r.id,
    r.client_id,
    r.type,
    r.workspace_id,
    r.start_date,
    r.billing_period_days,
    r.monthly_hours_threshold,
    r.package_hours,
    CASE r.type
      WHEN 'flat_monthly' THEN (r.monthly_hours_threshold * 60 * 90) / 100
      WHEN 'package_based' THEN (r.package_hours * 60 * 90) / 100
      ELSE NULL
    END AS threshold_min,
    r.start_date + (FLOOR((CURRENT_DATE - r.start_date) / r.billing_period_days) * r.billing_period_days)::int
      AS period_start
  FROM retainer_agreements r
  WHERE r.workspace_id = p_workspace_id
    AND r.status = 'active'
    AND r.type IN ('flat_monthly', 'package_based')
    AND (r.end_date IS NULL OR r.end_date >= CURRENT_DATE)
),
filtered_retainers AS (
  SELECT *
  FROM active_retainers
  WHERE threshold_min IS NOT NULL
    AND threshold_min > 0
    AND (type != 'flat_monthly' OR monthly_hours_threshold IS NOT NULL)
),
period_totals AS (
  SELECT
    r.id AS retainer_id,
    COALESCE(SUM(te.duration_minutes), 0) AS total_tracked
  FROM filtered_retainers r
  LEFT JOIN time_entries te ON te.client_id = r.client_id
    AND te.workspace_id = r.workspace_id
    AND te.date >= r.period_start
    AND te.date < r.period_start + r.billing_period_days
  GROUP BY r.id
)
SELECT
  r.id AS retainer_id,
  r.client_id,
  c.name AS client_name,
  r.type AS retainer_type,
  pt.total_tracked AS tracked_minutes,
  r.threshold_min AS threshold_minutes,
  CASE
    WHEN r.threshold_min > 0
    THEN FLOOR((pt.total_tracked * 100) / r.threshold_min)
    ELSE 0
  END::bigint AS utilization_percent
FROM filtered_retainers r
JOIN period_totals pt ON pt.retainer_id = r.id
JOIN clients c ON c.id = r.client_id
WHERE pt.total_tracked >= r.threshold_min;
$$;
