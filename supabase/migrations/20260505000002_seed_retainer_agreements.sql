-- Seed: Retainer agreement fixtures (Story 3.2, Task 1.16)
-- 5 fixtures: hourly active, flat_monthly at 70%, flat_monthly at 95%, package_based active, cancelled historical

-- 1. Hourly rate — active (client 001)
INSERT INTO retainer_agreements (workspace_id, client_id, type, hourly_rate_cents, billing_period_days, start_date, status)
VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'hourly_rate', 7500, 30, CURRENT_DATE, 'active')
ON CONFLICT DO NOTHING;

-- 2. Flat monthly at ~70% utilization — active (client 002)
INSERT INTO retainer_agreements (workspace_id, client_id, type, monthly_fee_cents, monthly_hours_threshold, billing_period_days, start_date, status)
VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'flat_monthly', 200000, 30.00, 30, CURRENT_DATE - INTERVAL '15 days', 'active')
ON CONFLICT DO NOTHING;

-- 3. Flat monthly at ~95% utilization — scope creep alert (client 003)
INSERT INTO retainer_agreements (workspace_id, client_id, type, monthly_fee_cents, monthly_hours_threshold, billing_period_days, start_date, status)
VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'flat_monthly', 150000, 20.00, 30, CURRENT_DATE - INTERVAL '25 days', 'active')
ON CONFLICT DO NOTHING;

-- 4. Package-based — active (client 004)
INSERT INTO retainer_agreements (workspace_id, client_id, type, package_hours, package_name, hourly_rate_cents, billing_period_days, start_date, status)
VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'package_based', 40.00, 'Social Media Management', 10000, 30, CURRENT_DATE, 'active')
ON CONFLICT DO NOTHING;

-- 5. Cancelled historical (client 001)
INSERT INTO retainer_agreements (workspace_id, client_id, type, monthly_fee_cents, monthly_hours_threshold, billing_period_days, start_date, end_date, status, cancelled_at, cancellation_reason)
VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005', 'flat_monthly', 100000, 15.00, 30, CURRENT_DATE - INTERVAL '120 days', CURRENT_DATE - INTERVAL '60 days', 'cancelled', CURRENT_DATE - INTERVAL '60 days', 'Client moved to hourly arrangement')
ON CONFLICT DO NOTHING;
