-- Migration: Fix tier_limits seed discrepancy (Story 9.4 AC7, EC12)
-- Purpose: Correct `pro.maxTeamMembers` from `1` (seeded in 20260618000002)
-- to `5`. The original value made Pro == Free for team members, violating
-- FR55's tier progression.
--
-- Idempotent: uses jsonb_set on the existing `tier_limits` row so re-running
-- a `supabase db reset` is safe. If the row is absent (fresh install without
-- the 9-3a seed), the WHERE guard skips the UPDATE.
--
-- Related:
--   - supabase/migrations/20260618000002_app_config_tier_seeding.sql (seed)
--   - apps/web/lib/config/tier-config.ts (getTierConfig reader)
--   - apps/web/__tests__/billing/9-4-tier-limits.spec.ts (EC12 verifies this)

UPDATE app_config
SET value = jsonb_set(value, '{pro,maxTeamMembers}', '5'::jsonb)
WHERE key = 'tier_limits'
  AND (value->'pro'->>'maxTeamMembers')::int = 1;
