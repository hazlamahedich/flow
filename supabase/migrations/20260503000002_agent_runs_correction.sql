-- Correction columns on agent_runs (Story 2.7)

CREATE TYPE agent_run_source AS ENUM ('agent', 'human_correction');

ALTER TABLE agent_runs ADD COLUMN corrected_run_id uuid NULL REFERENCES agent_runs(id);
ALTER TABLE agent_runs ADD COLUMN correction_depth smallint NOT NULL DEFAULT 0 CHECK (correction_depth >= 0 AND correction_depth <= 5);
ALTER TABLE agent_runs ADD COLUMN correction_issued boolean NOT NULL DEFAULT false;
ALTER TABLE agent_runs ADD COLUMN source agent_run_source NOT NULL DEFAULT 'agent';

CREATE INDEX idx_agent_runs_corrected ON agent_runs (corrected_run_id) WHERE corrected_run_id IS NOT NULL;
