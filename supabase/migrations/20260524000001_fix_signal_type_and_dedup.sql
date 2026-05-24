-- Migration: Fix signal_type CHECK to allow 3-segment dot format + add dedup_key
-- Fixes: Story 6-4 code review D1 (signal format) and D2 (dedup key)
-- Also fixes Story 6-2 pre-existing issue (conflict_detected format)

-- Fix signal_type CHECK constraint to allow 3-segment dots with lowercase + digits + hyphens
ALTER TABLE agent_signals DROP CONSTRAINT agent_signals_signal_type_check;
ALTER TABLE agent_signals ADD CONSTRAINT agent_signals_signal_type_check
  CHECK (signal_type ~ '^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$');

-- Add dedup_key column with partial unique index for signal deduplication
ALTER TABLE agent_signals ADD COLUMN dedup_key text;
CREATE UNIQUE INDEX idx_agent_signals_dedup ON agent_signals (dedup_key)
  WHERE dedup_key IS NOT NULL;
