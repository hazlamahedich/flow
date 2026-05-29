-- Migration: Relax weekly_report_sections section_type constraint, weekly_reports status constraint, and add draft idempotency
-- Date: 2026-05-29

-- Step 1: Drop anonymous check constraint on weekly_report_sections if exists
ALTER TABLE weekly_report_sections
  DROP CONSTRAINT IF EXISTS weekly_report_sections_section_type_check;

-- Step 2: Add relaxed check constraint with stalled_items and highlights
ALTER TABLE weekly_report_sections
  ADD CONSTRAINT weekly_report_sections_section_type_check
  CHECK (section_type IN ('time_summary', 'task_log', 'agent_activity', 'invoice_summary', 'stalled_items', 'highlights'));

-- Step 3: Drop anonymous check constraint on weekly_reports status if exists
ALTER TABLE weekly_reports
  DROP CONSTRAINT IF EXISTS weekly_reports_status_check;

-- Step 4: Add relaxed check constraint for weekly_reports status including 'rejected'
ALTER TABLE weekly_reports
  ADD CONSTRAINT weekly_reports_status_check
  CHECK (status IN ('draft', 'sent', 'viewed', 'approved', 'rejected'));

-- Step 5: Create partial unique index on weekly_reports for draft idempotency
-- Enforces only one draft report per client and period at any time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_reports_idempotency
  ON weekly_reports (client_id, period_start, period_end)
  WHERE status = 'draft';

-- Step 6: Create after-update trigger on agent_runs to update weekly_reports status to 'rejected' when draft proposal is cancelled (rejected)
CREATE OR REPLACE FUNCTION handle_agent_run_rejection()
RETURNS TRIGGER AS $$
DECLARE
  v_report_id UUID;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status = 'waiting_approval' AND NEW.agent_id = 'weekly-report' THEN
    -- Extract reportId from output JSONB (cast to UUID)
    v_report_id := (NEW.output->>'reportId')::UUID;
    IF v_report_id IS NOT NULL THEN
      UPDATE weekly_reports SET status = 'rejected', updated_at = now() WHERE id = v_report_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_agent_run_rejection
AFTER UPDATE ON agent_runs
FOR EACH ROW
WHEN (NEW.status = 'cancelled' AND OLD.status = 'waiting_approval')
EXECUTE FUNCTION handle_agent_run_rejection();
