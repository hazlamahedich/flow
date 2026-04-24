-- Add log_type column to llm_cost_logs for two-phase cost tracking
-- Related: Story 2.2 D3 — estimate (pre-call) vs actual (post-call) immutable rows

ALTER TABLE llm_cost_logs
  ADD COLUMN IF NOT EXISTS log_type text NOT NULL DEFAULT 'actual';

ALTER TABLE llm_cost_logs
  ADD CONSTRAINT chk_log_type CHECK (log_type IN ('estimate', 'actual'));
