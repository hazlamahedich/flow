-- Add acknowledged_at to trust_transitions for regression acknowledgment tracking
-- Related: Story 2.6b - Trust Ceremonies, Regression Handling & Milestones
-- Round 2 review fix: prevents infinite rehydration loop

ALTER TABLE trust_transitions
  ADD COLUMN acknowledged_at timestamptz;

CREATE INDEX idx_trust_transitions_acknowledged
  ON trust_transitions (workspace_id, acknowledged_at)
  WHERE acknowledged_at IS NULL;
