-- Performance indexes for agent action history (Story 2.7)
-- Required for <500ms SLA with 1000+ runs

CREATE INDEX idx_agent_runs_workspace_created_desc ON agent_runs (workspace_id, created_at DESC);
CREATE INDEX idx_agent_runs_workspace_correlation ON agent_runs (workspace_id, correlation_id);
CREATE INDEX idx_agent_runs_workspace_status_created ON agent_runs (workspace_id, status, created_at DESC);
CREATE INDEX idx_agent_signals_correlation_created ON agent_signals (correlation_id, created_at);
