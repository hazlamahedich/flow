-- Story 5-4a: Add start/end time tracking as integer minutes from midnight
-- Adds nullable start_minutes and end_minutes to time_entries for gap/overlap detection

ALTER TABLE time_entries
  ADD COLUMN start_minutes INTEGER,
  ADD COLUMN end_minutes INTEGER;

ALTER TABLE time_entries
  ADD CONSTRAINT chk_start_minutes_range
    CHECK (start_minutes IS NULL OR (start_minutes >= 0 AND start_minutes < 1440)),
  ADD CONSTRAINT chk_end_minutes_range
    CHECK (end_minutes IS NULL OR (end_minutes >= 0 AND end_minutes < 1440)),
  ADD CONSTRAINT chk_time_pair_both_or_neither
    CHECK (
      (start_minutes IS NULL AND end_minutes IS NULL) OR
      (start_minutes IS NOT NULL AND end_minutes IS NOT NULL)
    ),
  ADD CONSTRAINT chk_start_before_end
    CHECK (start_minutes IS NULL OR end_minutes IS NULL OR start_minutes < end_minutes);

CREATE INDEX idx_time_entries_date_start_minutes
  ON time_entries (workspace_id, date, start_minutes)
  WHERE start_minutes IS NOT NULL AND end_minutes IS NOT NULL AND deleted_at IS NULL;

-- DOWN: callable rollback function
CREATE OR REPLACE FUNCTION rollback_add_start_end_minutes() RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  DROP INDEX IF EXISTS idx_time_entries_date_start_minutes;
  ALTER TABLE time_entries
    DROP CONSTRAINT IF EXISTS chk_start_before_end,
    DROP CONSTRAINT IF EXISTS chk_time_pair_both_or_neither,
    DROP CONSTRAINT IF EXISTS chk_end_minutes_range,
    DROP CONSTRAINT IF EXISTS chk_start_minutes_range,
    DROP COLUMN IF EXISTS end_minutes,
    DROP COLUMN IF EXISTS start_minutes;
END;
$$;
