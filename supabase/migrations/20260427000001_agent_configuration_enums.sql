-- Agent configuration enums: agent_status and integration_health_type
-- Related: Story 2.2 - Agent Activation, Configuration & Scheduling

CREATE TYPE agent_status AS ENUM (
  'inactive',
  'activating',
  'active',
  'draining',
  'suspended'
);

CREATE TYPE integration_health_type AS ENUM (
  'healthy',
  'degraded',
  'disconnected'
);
