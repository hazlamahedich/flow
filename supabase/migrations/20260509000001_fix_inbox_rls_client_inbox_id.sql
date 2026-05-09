-- Migration: Fix RLS policies missing client_inbox_id filter
-- Addresses: T3 from Epic 4 retro
-- Issue: inbox_trust_metrics and email_processing_state only filter on workspace_id,
--        allowing cross-client data leakage within a workspace.

-- Fix inbox_trust_metrics: add client_inbox_id subquery check
DROP POLICY IF EXISTS policy_inbox_trust_metrics_select_member ON inbox_trust_metrics;

CREATE POLICY policy_inbox_trust_metrics_select_member
  ON inbox_trust_metrics
  FOR SELECT
  TO authenticated
  USING (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND EXISTS (
      SELECT 1 FROM client_inboxes ci
      WHERE ci.id = inbox_trust_metrics.client_inbox_id
        AND ci.workspace_id::text = auth.jwt()->>'workspace_id'
    )
  );

-- Fix email_processing_state: add workspace_id + correlated client_inbox check
-- Note: email_processing_state has no client_inbox_id column, but is always accessed
-- via email_id which links to emails.client_inbox_id. Add subquery through emails.
DROP POLICY IF EXISTS policy_email_processing_state_all_member ON email_processing_state;

CREATE POLICY policy_email_processing_state_all_member
  ON email_processing_state
  FOR ALL
  TO authenticated
  USING (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND EXISTS (
      SELECT 1 FROM emails e
      WHERE e.id = email_processing_state.email_id
        AND e.workspace_id = email_processing_state.workspace_id
    )
  )
  WITH CHECK (
    workspace_id::text = auth.jwt()->>'workspace_id'
    AND EXISTS (
      SELECT 1 FROM emails e
      WHERE e.id = email_processing_state.email_id
        AND e.workspace_id = email_processing_state.workspace_id
    )
  );
