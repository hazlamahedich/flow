-- Agent ENUM types for orchestration state machine
-- Related: Story 2.1a - Agent Orchestrator Interface & Schema Foundation

CREATE TYPE agent_run_status AS ENUM (
  'queued',
  'running',
  'waiting_approval',
  'completed',
  'failed',
  'timed_out',
  'cancelled'
);

CREATE TYPE agent_id_type AS ENUM (
  'inbox',
  'calendar',
  'ar-collection',
  'weekly-report',
  'client-health',
  'time-integrity'
);
