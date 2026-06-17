-- Migration: Workspace subscription columns + invoice dedup hash (Epic 9, Story 9-3a)
-- Purpose: Add subscription lifecycle columns to workspaces, dedup_hash to invoices,
--          partial indexes, and SECURITY DEFINER RPCs for subscription upserts.
-- Related: packages/db/src/schema/workspaces.ts, packages/db/src/schema/invoices.ts

-- ============================================
-- workspaces: subscription lifecycle columns
-- ============================================
ALTER TABLE workspaces
  ADD COLUMN subscription_status TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN subscription_tier TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN stripe_customer_id TEXT UNIQUE,
  ADD COLUMN stripe_subscription_id TEXT UNIQUE,
  ADD COLUMN subscription_current_period_start TIMESTAMPTZ,
  ADD COLUMN subscription_current_period_end TIMESTAMPTZ,
  ADD COLUMN subscription_cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN subscription_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE workspaces
  ADD CONSTRAINT workspaces_subscription_status_valid
    CHECK (subscription_status IN ('free', 'active', 'past_due', 'cancelled')),
  ADD CONSTRAINT workspaces_subscription_tier_valid
    CHECK (subscription_tier IN ('free', 'pro', 'agency'));

CREATE INDEX idx_workspaces_stripe_customer
  ON workspaces(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX idx_workspaces_stripe_subscription
  ON workspaces(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- ============================================
-- invoices: duplicate creation guard
-- ============================================
ALTER TABLE invoices
  ADD COLUMN dedup_hash TEXT;

CREATE UNIQUE INDEX idx_invoices_dedup_hash
  ON invoices(dedup_hash)
  WHERE dedup_hash IS NOT NULL;

-- ============================================
-- Auto-update subscription_updated_at
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
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_workspace_subscription_updated_at
  BEFORE UPDATE ON workspaces
  FOR EACH ROW
  WHEN (
    NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
    OR NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier
    OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
    OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
    OR NEW.subscription_current_period_start IS DISTINCT FROM OLD.subscription_current_period_start
    OR NEW.subscription_current_period_end IS DISTINCT FROM OLD.subscription_current_period_end
    OR NEW.subscription_cancel_at_period_end IS DISTINCT FROM OLD.subscription_cancel_at_period_end
  )
  EXECUTE FUNCTION update_workspace_subscription_updated_at();

-- ============================================
-- RPC: upsert_workspace_subscription
-- Security: SECURITY DEFINER + REVOKE FROM PUBLIC. Webhook callers hold
-- service_role (which bypasses GRANT) but defense-in-depth is mirrored from
-- the 9-2 `log_client_notification` RPC pattern.
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
  -- Verify workspace exists
  SELECT id, subscription_current_period_end
    INTO v_workspace_id, v_existing_period_end
    FROM workspaces
   WHERE id = p_workspace_id
   FOR UPDATE;

  IF v_workspace_id IS NULL THEN
    RETURN jsonb_build_object('error', 'WORKSPACE_NOT_FOUND');
  END IF;

  -- Validate enums
  IF p_status NOT IN ('free', 'active', 'past_due', 'cancelled') THEN
    RETURN jsonb_build_object('error', 'INVALID_STATUS');
  END IF;

  IF p_tier NOT IN ('free', 'pro', 'agency') THEN
    RETURN jsonb_build_object('error', 'INVALID_TIER');
  END IF;

  -- Out-of-order delivery guard: only overwrite period dates if incoming is newer.
  -- A NULL existing period means "no prior data" and should be overwritten.
  BEGIN
    IF v_existing_period_end IS NOT NULL
       AND p_current_period_end IS NOT NULL
       AND p_current_period_end < v_existing_period_end
    THEN
      -- Keep existing period dates; still update status/tier/cancel flag if changed.
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
-- RPC: set_workspace_subscription_status
-- Used by invoice.payment_failed / invoice.paid / customer.subscription.deleted
-- when only status (and optionally period_end) changes.
-- p_clear_period_end = TRUE explicitly sets period_end to NULL (needed by AC5
-- `customer.subscription.deleted`). p_clear_period_end = FALSE keeps existing.
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

  IF p_status NOT IN ('free', 'active', 'past_due', 'cancelled') THEN
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
