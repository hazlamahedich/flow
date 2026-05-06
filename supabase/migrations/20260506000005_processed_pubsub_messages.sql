-- Migration: Add processed_pubsub_messages table (Epic 4, Story 4.1)
-- Purpose: Idempotency check for Gmail Pub/Sub webhook
-- Related: AC7

CREATE TABLE processed_pubsub_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  message_id text NOT NULL,
  client_inbox_id uuid REFERENCES client_inboxes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_processed_pubsub_message_id
  ON processed_pubsub_messages (message_id);

ALTER TABLE processed_pubsub_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY rls_processed_pubsub_service_role ON processed_pubsub_messages
  FOR ALL TO authenticated
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
