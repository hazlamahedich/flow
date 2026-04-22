-- Add completed_onboarding flag to users table
-- Related: Story 1.10 - Day 1 Onboarding Wizard

ALTER TABLE users ADD COLUMN completed_onboarding boolean NOT NULL DEFAULT false;

CREATE INDEX idx_users_completed_onboarding ON users (completed_onboarding) WHERE completed_onboarding = false;
