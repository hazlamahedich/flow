-- Migration: Canonical test-safe tier_limits and Stripe price IDs
-- Purpose: Replace stale/legacy tier_limits shape and placeholder Stripe IDs
--          with values that pass getTierConfig validation in CI/E2E.
-- Runs after all seeding migrations so it overwrites any earlier drift.

UPDATE app_config
   SET value = '{
     "free": {"maxClients": 2, "maxTeamMembers": 1, "maxAgents": 2},
     "pro": {"maxClients": 15, "maxTeamMembers": 5, "maxAgents": 6},
     "agency": {"maxClients": null, "maxTeamMembers": null, "maxAgents": null}
   }'::jsonb,
       updated_at = now()
 WHERE key = 'tier_limits';

UPDATE app_config
   SET value = '{"pro_monthly": "price_test_pro_monthly", "agency_monthly": "price_test_agency_monthly"}'::jsonb,
       updated_at = now()
 WHERE key = 'stripe_prices';
