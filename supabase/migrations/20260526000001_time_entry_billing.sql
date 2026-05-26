-- Migration: Add invoiced_at column and resolve_hourly_rate RPC for time entry billing (Story 7-3a)
-- Purpose: Track whether time entries have been invoiced and provide hourly rate resolution function.

-- ============================================
-- time_entries schema update
-- ============================================
ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS invoiced_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_time_entries_invoiced_at ON time_entries (invoiced_at)
  WHERE invoiced_at IS NOT NULL;

-- ============================================
-- RPC: resolve_hourly_rate
-- ============================================
-- Resolve hourly rate for a client in this precedence order:
-- 1. Active retainer agreement with hourly_rate_cents > 0
-- 2. Client's own hourly_rate_cents > 0
-- Returns null if neither exists.
-- ============================================
CREATE OR REPLACE FUNCTION resolve_hourly_rate(
  p_client_id UUID,
  p_workspace_id UUID DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_rate BIGINT;
BEGIN
  -- Priority 1: Active retainer with positive hourly_rate_cents
  SELECT hourly_rate_cents
    INTO v_rate
    FROM retainer_agreements
    WHERE client_id = p_client_id
      AND (p_workspace_id IS NULL OR workspace_id = p_workspace_id)
      AND status = 'active'
      AND hourly_rate_cents IS NOT NULL
      AND hourly_rate_cents > 0
    ORDER BY created_at DESC
    LIMIT 1;

  IF v_rate IS NOT NULL THEN
    RETURN v_rate;
  END IF;

  -- Priority 2: Client's own hourly_rate_cents
  SELECT hourly_rate_cents
    INTO v_rate
    FROM clients
    WHERE id = p_client_id
      AND (p_workspace_id IS NULL OR workspace_id = p_workspace_id)
      AND hourly_rate_cents IS NOT NULL
      AND hourly_rate_cents > 0;

  RETURN v_rate;
END;
$$;

-- Prevent a time entry from appearing on multiple invoices
CREATE UNIQUE INDEX IF NOT EXISTS invoice_line_items_unique_time_entry
  ON invoice_line_items (time_entry_id)
  WHERE time_entry_id IS NOT NULL;
