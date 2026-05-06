-- Migration: Add raw_pubsub_payloads table (Epic 4, Story 4.1)
-- Purpose: Buffer Gmail Pub/Sub push notifications for Story 4.2 processing
-- Related: AC7

CREATE TABLE raw_pubsub_payloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_inbox_id uuid REFERENCES client_inboxes(id) ON DELETE SET NULL,
  email_address text NOT NULL,
  history_id text NOT NULL,
  raw_payload jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_raw_pubsub_workspace_unprocessed
  ON raw_pubsub_payloads (workspace_id, created_at) WHERE processed = false;

CREATE INDEX idx_raw_pubsub_email_created
  ON raw_pubsub_payloads (email_address, created_at DESC);

ALTER TABLE raw_pubsub_payloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY rls_raw_pubsub_service_role ON raw_pubsub_payloads
  FOR ALL TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
