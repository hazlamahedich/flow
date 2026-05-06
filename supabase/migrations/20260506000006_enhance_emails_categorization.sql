-- Migration: Enhance emails table for categorization (Epic 4, Story 4.2)
-- Purpose: Add columns for AI categorization results and trust scoring

ALTER TABLE emails ADD COLUMN category text;
ALTER TABLE emails ADD COLUMN confidence float;
ALTER TABLE emails ADD COLUMN requires_confirmation boolean DEFAULT false;
ALTER TABLE emails ADD COLUMN processed_at timestamptz;

-- Index for categorization triage
CREATE INDEX idx_emails_workspace_category_received
  ON emails (workspace_id, category, received_at DESC);

-- Comment for auditability
COMMENT ON COLUMN emails.category IS 'AI-assigned category: urgent, action, info, noise';
COMMENT ON COLUMN emails.confidence IS 'AI confidence score (0-1)';
COMMENT ON COLUMN emails.requires_confirmation IS 'True if email content triggered low-trust/high-instruction density warning';
