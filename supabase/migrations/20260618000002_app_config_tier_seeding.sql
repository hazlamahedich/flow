-- Migration: Seed app_config tier limits and Stripe placeholders (Epic 9, Story 9-3a)
-- Purpose: Idempotent seed rows for tier limits, Stripe price placeholders,
--          grace/suspension windows, and free-tier transaction fee.
-- Related: packages/db/src/schema/app-config.ts, apps/web/lib/config/tier-config.ts

INSERT INTO app_config (key, value)
VALUES (
  'tier_limits',
  '{
    "free": {"maxClients": 3, "maxTeamMembers": 1, "maxAgents": 2},
    "pro": {"maxClients": 15, "maxTeamMembers": 1, "maxAgents": 6},
    "agency": {"maxClients": null, "maxTeamMembers": null, "maxAgents": null}
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_config (key, value)
VALUES (
  'stripe_prices',
  '{
    "pro_monthly": "price_placeholder_pro_monthly",
    "agency_monthly": "price_placeholder_agency_monthly"
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_config (key, value)
VALUES ('subscription_grace_period_days', '7'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_config (key, value)
VALUES ('subscription_suspension_period_days', '30'::jsonb)
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_config (key, value)
VALUES ('stripe_free_transaction_fee_percent', '5'::jsonb)
ON CONFLICT (key) DO NOTHING;
