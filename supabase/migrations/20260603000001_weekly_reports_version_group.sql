-- Story 8-1c: Add version_group_id for O(1) version grouping
-- Replaces linked-list traversal via parent_report_id with direct group lookup.
-- All versions of the same logical report share version_group_id.

ALTER TABLE weekly_reports
  ADD COLUMN IF NOT EXISTS version_group_id UUID;

ALTER TABLE weekly_reports
  DROP CONSTRAINT IF EXISTS fk_version_group;

ALTER TABLE weekly_reports
  ADD CONSTRAINT fk_version_group FOREIGN KEY (version_group_id) REFERENCES weekly_reports(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_weekly_reports_version_group
  ON weekly_reports (version_group_id)
  WHERE version_group_id IS NOT NULL;

-- Backfill: each existing report is its own group (single-report, no versions yet)
UPDATE weekly_reports
  SET version_group_id = id
  WHERE version_group_id IS NULL;
