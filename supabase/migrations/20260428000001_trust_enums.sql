-- Trust level enum for trust graduation system
-- Related: Story 2.3 - Trust Matrix & Graduation System

CREATE TYPE trust_level AS ENUM (
  'supervised',
  'confirm',
  'auto'
);
