-- Story 2.4: Add trust_snapshot_id to agent_runs for gate-to-gate snapshotId persistence
-- The snapshotId from canAct() must survive process restarts and cache eviction.
-- All downstream calls (recordViolation, recordPrecheckFailure) read it from the run record.

ALTER TABLE agent_runs
  ADD COLUMN trust_snapshot_id UUID REFERENCES trust_snapshots(id) ON DELETE SET NULL;

CREATE INDEX idx_agent_runs_trust_snapshot_id ON agent_runs(trust_snapshot_id);
