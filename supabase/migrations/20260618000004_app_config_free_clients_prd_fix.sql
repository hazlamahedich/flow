-- Migration: PRD-canonical Free maxClients=2 (Story 9.5b T8.1 — P0 fix)
-- Purpose: Reset the Free tier's `maxClients` from 3 (running 9-4 seed at
--          20260618000002) and 5 (original seed at 20260420140004) to the
--          PRD-canonical value of **2** (prd.md:433,587,865).
--
--          Journey 8 ("Maya feels the pain of 5 clients outside Flow OS
--          constrained to 2 inside") relies on Free=2 as the Free→Paid
--          conversion pressure. The 9-4 story shipped with maxClients=3
--          (a typo at seed time); this migration corrects the canonical
--          value. A P0 ticket against 9-4 records the shipped-code drift.
--
-- Idempotent via jsonb_set + COALESCE — safe to re-run.
-- Append-only (project-context.md:390).
--
-- Related:
--   - packages/db/src/schema/app-config.ts
--   - apps/web/lib/config/tier-config.ts (reads via getTierConfig)
--   - apps/web/lib/actions/billing/enforce-tier-limit.ts
--   - apps/web/lib/actions/billing/downgrade-internal.ts (uses Free limit)
--   - packages/agents/orchestrator/reconcile-subscriptions/run-reconciliation.ts
--     (correctTierDrift uses the same value)

UPDATE app_config
   SET value = jsonb_set(
       value,
       '{free,maxClients}',
       '2'::jsonb,
       true
     ),
     updated_at = now()
 WHERE key = 'tier_limits';

-- Smoke-check the value landed (helpful when running migrations in CI).
DO $$
DECLARE
  v_max_clients int;
BEGIN
  SELECT (value->'free'->>'maxClients')::int
    INTO v_max_clients
    FROM app_config
   WHERE key = 'tier_limits';

  IF v_max_clients IS NULL THEN
    RAISE WARNING 'tier_limits.free.maxClients is NULL after migration — expected 2';
  ELSIF v_max_clients <> 2 THEN
    RAISE WARNING 'tier_limits.free.maxClients = % (expected 2)', v_max_clients;
  END IF;
END
$$;

-- ════════════════════════════════════════════════════════════════
-- Down SQL (revert to 9-4's shipped value of 3 — NOT recommended; PRD=2 is canonical):
--   UPDATE app_config
--      SET value = jsonb_set(value, '{free,maxClients}', '3'::jsonb, true)
--    WHERE key = 'tier_limits';
-- ════════════════════════════════════════════════════════════════
