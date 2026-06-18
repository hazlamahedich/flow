-- Migration: Subscription lifecycle states (Epic 9, Story 9.5a — FR59)
-- Purpose: Extend `workspaces.subscription_status` CHECK constraint to include
--          `suspended` and `deleted` (FR59 lifecycle), add a dedicated status
--          timestamp column, replace the two existing RPCs with 6-state
--          allowlists, and add two new conditional-write RPCs:
--            1. `transition_workspace_subscription_status` (conditional write)
--            2. `transition_to_suspended_any` (webhook single-call jump).
--
-- Append-only (project-context.md:390). Idempotent guard on CHECK change.
-- No data migration — existing rows remain valid; new statuses set going
-- forward (EC10).
--
-- Down-test note (project-context.md:395-396): down will fail if any row is
-- already in `suspended`/`deleted`. Acceptable — rolling back a lifecycle
-- migration after live data exists is a manual ops decision, not an automated
-- one.

-- ============================================
-- 1. Add dedicated status-change timestamp (review consensus 2026-06-18)
-- ============================================
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS subscription_status_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill from the generic subscription_updated_at so existing rows keep their
-- current effective sweep timing. This is a one-time cutover; future status
-- changes will update subscription_status_updated_at explicitly.
UPDATE workspaces
   SET subscription_status_updated_at = subscription_updated_at
 WHERE subscription_status_updated_at <> subscription_updated_at;

CREATE INDEX IF NOT EXISTS idx_workspaces_subscription_status_updated_at
  ON workspaces(subscription_status_updated_at)
  WHERE subscription_status_updated_at IS NOT NULL;

-- ============================================
-- 2. Extend subscription_status CHECK (AC1)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'workspaces_subscription_status_valid'
      AND conrelid = 'workspaces'::regclass
      AND pg_get_constraintdef(oid) LIKE '%suspended%'
  ) THEN
    ALTER TABLE workspaces
      DROP CONSTRAINT IF EXISTS workspaces_subscription_status_valid;
    ALTER TABLE workspaces
      ADD CONSTRAINT workspaces_subscription_status_valid
        CHECK (subscription_status IN (
          'free', 'active', 'past_due', 'cancelled', 'suspended', 'deleted'
        ));
  END IF;
END
$$;

-- ============================================
-- 3. Update trigger to also refresh subscription_status_updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_workspace_subscription_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
     OR NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier
     OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
     OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
     OR NEW.subscription_current_period_start IS DISTINCT FROM OLD.subscription_current_period_start
     OR NEW.subscription_current_period_end IS DISTINCT FROM OLD.subscription_current_period_end
     OR NEW.subscription_cancel_at_period_end IS DISTINCT FROM OLD.subscription_cancel_at_period_end
  THEN
    NEW.subscription_updated_at = now();
  END IF;

  IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status THEN
    NEW.subscription_status_updated_at = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. Replace upsert_workspace_subscription (6-state allowlist)
-- ============================================
CREATE OR REPLACE FUNCTION upsert_workspace_subscription(
  p_workspace_id UUID,
  p_stripe_customer_id TEXT,
  p_stripe_subscription_id TEXT,
  p_tier TEXT,
  p_status TEXT,
  p_current_period_start TIMESTAMPTZ,
  p_current_period_end TIMESTAMPTZ,
  p_cancel_at_period_end BOOLEAN DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_workspace_id UUID;
  v_existing_period_end TIMESTAMPTZ;
BEGIN
  SELECT id, subscription_current_period_end
    INTO v_workspace_id, v_existing_period_end
    FROM workspaces
   WHERE id = p_workspace_id
   FOR UPDATE;

  IF v_workspace_id IS NULL THEN
    RETURN jsonb_build_object('error', 'WORKSPACE_NOT_FOUND');
  END IF;

  -- 6-state allowlist (extended by 9-5a from the 9-3a 4-state version).
  IF p_status NOT IN ('free', 'active', 'past_due', 'cancelled', 'suspended', 'deleted') THEN
    RETURN jsonb_build_object('error', 'INVALID_STATUS');
  END IF;

  IF p_tier NOT IN ('free', 'pro', 'agency') THEN
    RETURN jsonb_build_object('error', 'INVALID_TIER');
  END IF;

  BEGIN
    IF v_existing_period_end IS NOT NULL
       AND p_current_period_end IS NOT NULL
       AND p_current_period_end < v_existing_period_end
    THEN
      UPDATE workspaces
         SET stripe_customer_id = p_stripe_customer_id,
             stripe_subscription_id = p_stripe_subscription_id,
             subscription_status = p_status,
             subscription_tier = p_tier,
             subscription_cancel_at_period_end = p_cancel_at_period_end
       WHERE id = p_workspace_id;
    ELSE
      UPDATE workspaces
         SET stripe_customer_id = p_stripe_customer_id,
             stripe_subscription_id = p_stripe_subscription_id,
             subscription_status = p_status,
             subscription_tier = p_tier,
             subscription_current_period_start = p_current_period_start,
             subscription_current_period_end = p_current_period_end,
             subscription_cancel_at_period_end = p_cancel_at_period_end
       WHERE id = p_workspace_id;
    END IF;
  EXCEPTION
    WHEN unique_violation THEN
      RETURN jsonb_build_object('error', 'CUSTOMER_IN_USE');
  END;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION upsert_workspace_subscription(UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_workspace_subscription(UUID, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, BOOLEAN) TO authenticated, service_role;

-- ============================================
-- 3. Replace set_workspace_subscription_status (6-state allowlist)
-- ============================================
CREATE OR REPLACE FUNCTION set_workspace_subscription_status(
  p_workspace_id UUID,
  p_status TEXT,
  p_current_period_end TIMESTAMPTZ DEFAULT NULL,
  p_clear_period_end BOOLEAN DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_workspace_id UUID;
BEGIN
  SELECT id INTO v_workspace_id
    FROM workspaces
   WHERE id = p_workspace_id
   FOR UPDATE;

  IF v_workspace_id IS NULL THEN
    RETURN jsonb_build_object('error', 'WORKSPACE_NOT_FOUND');
  END IF;

  IF p_status NOT IN ('free', 'active', 'past_due', 'cancelled', 'suspended', 'deleted') THEN
    RETURN jsonb_build_object('error', 'INVALID_STATUS');
  END IF;

  IF p_clear_period_end THEN
    UPDATE workspaces
       SET subscription_status = p_status,
           subscription_current_period_end = NULL
     WHERE id = p_workspace_id;
  ELSE
    UPDATE workspaces
       SET subscription_status = p_status,
           subscription_current_period_end = COALESCE(p_current_period_end, subscription_current_period_end)
     WHERE id = p_workspace_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION set_workspace_subscription_status(UUID, TEXT, TIMESTAMPTZ, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_workspace_subscription_status(UUID, TEXT, TIMESTAMPTZ, BOOLEAN) TO authenticated, service_role;

-- ============================================
-- 4. NEW: transition_workspace_subscription_status (conditional write)
-- Canonical conditional-write primitive (Epic 8 retro #5, project-context.md:494).
-- Callers that already hold workspace-scoped authorization (system cron via
-- `service_role`, webhook route, or an owner-authorized Server Action) may call
-- this directly. For user-facing surfaces, expose via an action that verifies
-- ownership — do NOT call from unguarded user code.
-- Returns:
--   { "success": true }                       — exactly one row updated
--   { "error": "PRECONDITION_FAILED" }        — zero rows (status already moved)
--   { "error": "INVALID_STATUS" }             — p_to_status outside allowlist
-- ============================================
CREATE OR REPLACE FUNCTION transition_workspace_subscription_status(
  p_workspace_id UUID,
  p_from_status TEXT,
  p_to_status TEXT,
  p_clear_period_end BOOLEAN DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_updated UUID;
BEGIN
  IF p_to_status NOT IN ('free', 'active', 'past_due', 'cancelled', 'suspended', 'deleted') THEN
    RETURN jsonb_build_object('error', 'INVALID_STATUS');
  END IF;

  UPDATE workspaces
     SET subscription_status = p_to_status,
         subscription_status_updated_at = now(),
         subscription_current_period_end = CASE
           WHEN p_clear_period_end THEN NULL
           ELSE subscription_current_period_end
         END
   WHERE id = p_workspace_id
     AND subscription_status = p_from_status
   RETURNING id INTO v_updated;

  IF v_updated IS NULL THEN
    RETURN jsonb_build_object('error', 'PRECONDITION_FAILED');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION transition_workspace_subscription_status(UUID, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION transition_workspace_subscription_status(UUID, TEXT, TEXT, BOOLEAN) TO authenticated, service_role;

-- ============================================
-- 5. NEW: transition_to_suspended_any (single-call webhook jump)
-- Used by the Stripe `customer.subscription.deleted` handler (AC5).
-- Performs `UPDATE ... WHERE id = $ws AND status IN ('active','past_due','cancelled')`.
-- Idempotent — a duplicate webhook delivery is a no-op (returns
-- PRECONDITION_FAILED, handler treats it as processed:true).
-- Called only by the Stripe webhook route (which validates the Stripe
-- signature); SECURITY DEFINER does not re-verify workspace ownership because
-- the webhook is system-authorized by signature, not user identity.
-- No user-facing Server Action may call this RPC directly.
-- ============================================
CREATE OR REPLACE FUNCTION transition_to_suspended_any(
  p_workspace_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_updated UUID;
BEGIN
  UPDATE workspaces
     SET subscription_status = 'suspended',
         subscription_status_updated_at = now(),
         subscription_current_period_end = NULL
   WHERE id = p_workspace_id
     AND subscription_status IN ('active', 'past_due', 'cancelled')
   RETURNING id INTO v_updated;

  IF v_updated IS NULL THEN
    RETURN jsonb_build_object('error', 'PRECONDITION_FAILED');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION transition_to_suspended_any(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION transition_to_suspended_any(UUID) TO service_role;

-- ============================================
-- 6. Down migration (project-context.md:388-396)
-- WARNING: down will fail if any workspace already has subscription_status
-- in ('suspended', 'deleted'). Rolling back a lifecycle migration after live
-- data exists requires manual ops intervention, not an automated down.
-- ============================================
--
-- -- DOWN SQL (apply only on empty/fresh lifecycle states):
-- --
-- -- ALTER TABLE workspaces
-- --   DROP CONSTRAINT IF EXISTS workspaces_subscription_status_valid;
-- --
-- -- ALTER TABLE workspaces
-- --   ADD CONSTRAINT workspaces_subscription_status_valid
-- --     CHECK (subscription_status IN ('free', 'active', 'past_due', 'cancelled'));
-- --
-- -- CREATE OR REPLACE FUNCTION upsert_workspace_subscription(...)
-- --   ... original 4-state allowlist ...
-- --
-- -- CREATE OR REPLACE FUNCTION set_workspace_subscription_status(...)
-- --   ... original 4-state allowlist ...
-- --
-- -- DROP FUNCTION IF EXISTS transition_workspace_subscription_status(UUID, TEXT, TEXT, BOOLEAN);
-- -- DROP FUNCTION IF EXISTS transition_to_suspended_any(UUID);
-- --
-- -- ALTER TABLE workspaces
-- --   DROP COLUMN IF EXISTS subscription_status_updated_at;
-- --
-- -- DROP INDEX IF EXISTS idx_workspaces_subscription_status_updated_at;
-- --
-- -- DROP TRIGGER IF EXISTS set_workspace_subscription_updated_at ON workspaces;
-- -- DROP FUNCTION IF EXISTS update_workspace_subscription_updated_at();
--
-- Test: down-test comment block present per project-context.md:395.
