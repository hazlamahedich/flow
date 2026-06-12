-- Seed: Retainer agreement fixtures (Story 3.2, Task 1.16)
-- 5 fixtures: hourly active, flat_monthly at 70%, flat_monthly at 95%, package_based active, cancelled historical
-- Guarded: only inserts when workspace + client FK records exist

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM workspaces WHERE id = '00000000-0000-0000-0000-000000000001') THEN
    INSERT INTO retainer_agreements (workspace_id, client_id, type, hourly_rate_cents, billing_period_days, start_date, status)
    SELECT '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'hourly_rate', 7500, 30, CURRENT_DATE, 'active'
    WHERE EXISTS (SELECT 1 FROM clients WHERE id = '00000000-0000-0000-0000-000000000001')
    ON CONFLICT DO NOTHING;

    INSERT INTO retainer_agreements (workspace_id, client_id, type, monthly_fee_cents, monthly_hours_threshold, billing_period_days, start_date, status)
    SELECT '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'flat_monthly', 200000, 30.00, 30, CURRENT_DATE - INTERVAL '15 days', 'active'
    WHERE EXISTS (SELECT 1 FROM clients WHERE id = '00000000-0000-0000-0000-000000000002')
    ON CONFLICT DO NOTHING;

    INSERT INTO retainer_agreements (workspace_id, client_id, type, monthly_fee_cents, monthly_hours_threshold, billing_period_days, start_date, status)
    SELECT '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'flat_monthly', 150000, 20.00, 30, CURRENT_DATE - INTERVAL '25 days', 'active'
    WHERE EXISTS (SELECT 1 FROM clients WHERE id = '00000000-0000-0000-0000-000000000003')
    ON CONFLICT DO NOTHING;

    INSERT INTO retainer_agreements (workspace_id, client_id, type, package_hours, package_name, hourly_rate_cents, billing_period_days, start_date, status)
    SELECT '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'package_based', 40.00, 'Social Media Management', 10000, 30, CURRENT_DATE, 'active'
    WHERE EXISTS (SELECT 1 FROM clients WHERE id = '00000000-0000-0000-0000-000000000004')
    ON CONFLICT DO NOTHING;

    INSERT INTO retainer_agreements (workspace_id, client_id, type, monthly_fee_cents, monthly_hours_threshold, billing_period_days, start_date, end_date, status, cancelled_at, cancellation_reason)
    SELECT '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005', 'flat_monthly', 100000, 15.00, 30, CURRENT_DATE - INTERVAL '120 days', CURRENT_DATE - INTERVAL '60 days', 'cancelled', CURRENT_DATE - INTERVAL '60 days', 'Client moved to hourly arrangement'
    WHERE EXISTS (SELECT 1 FROM clients WHERE id = '00000000-0000-0000-0000-000000000005')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
