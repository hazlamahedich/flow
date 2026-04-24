-- Code review fixes for trust tables
-- Related: Story 2.3 adversarial code review findings
-- Fixes: FK cascade, missing indexes, counter constraints, updated_at trigger

-- F1+F2: trust_snapshots FK fixes — prevent workspace deletion failure
ALTER TABLE trust_snapshots
  DROP CONSTRAINT trust_snapshots_execution_id_fkey;

ALTER TABLE trust_snapshots
  ADD CONSTRAINT fk_trust_snapshots_workspace
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;

ALTER TABLE trust_snapshots
  ADD CONSTRAINT fk_trust_snapshots_execution
  FOREIGN KEY (execution_id) REFERENCES agent_runs(id) ON DELETE CASCADE;

-- F3: Missing ::text expression indexes for RLS optimization
CREATE INDEX idx_trust_transitions_workspace_text
  ON trust_transitions((workspace_id::text));
CREATE INDEX idx_trust_snapshots_workspace_text
  ON trust_snapshots((workspace_id::text));

-- F9: Counter columns CHECK constraints
ALTER TABLE trust_matrix ADD CONSTRAINT chk_total_executions_nonneg
  CHECK (total_executions >= 0);
ALTER TABLE trust_matrix ADD CONSTRAINT chk_successful_executions_nonneg
  CHECK (successful_executions >= 0);
ALTER TABLE trust_matrix ADD CONSTRAINT chk_consecutive_successes_nonneg
  CHECK (consecutive_successes >= 0);
ALTER TABLE trust_matrix ADD CONSTRAINT chk_violation_count_nonneg
  CHECK (violation_count >= 0);
ALTER TABLE trust_matrix ADD CONSTRAINT chk_successful_lte_total
  CHECK (successful_executions <= total_executions);

-- F8: Auto-update trigger for trust_matrix.updated_at
CREATE OR REPLACE FUNCTION fn_trust_matrix_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_trust_matrix_updated_at
  BEFORE UPDATE ON trust_matrix
  FOR EACH ROW EXECUTE FUNCTION fn_trust_matrix_updated_at();
