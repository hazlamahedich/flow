-- Migration: Story 4.5: Unified Communication Timeline
-- Purpose: Add index and RPC for client engagement timeline

-- Task 1.1: Add composite index for agent_runs
CREATE INDEX IF NOT EXISTS idx_agent_runs_workspace_client_created 
  ON agent_runs(workspace_id, client_id, created_at DESC);

-- Task 1.3: Create Postgres RPC function for timeline
CREATE OR REPLACE FUNCTION get_client_engagement_timeline(
  p_workspace_id uuid,
  p_client_id uuid,
  p_event_type text DEFAULT 'all',
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL,
  p_cursor_timestamp timestamptz DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL,
  p_cursor_kind text DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  kind text,
  id uuid,
  sort_timestamp timestamptz,
  data jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH timeline AS (
    -- Emails
    SELECT 
      'email'::text as kind,
      e.id,
      e.received_at as sort_timestamp,
      jsonb_build_object(
        'id', e.id,
        'receivedAt', e.received_at,
        'subject', e.subject,
        'fromAddress', e.from_address,
        'category', e.category,
        'requiresConfirmation', e.requires_confirmation,
        'processingState', eps.state
      ) as data
    FROM emails e
    LEFT JOIN email_processing_state eps ON e.id = eps.email_id AND e.workspace_id = eps.workspace_id
    WHERE e.workspace_id = p_workspace_id
      AND e.client_id = p_client_id
      AND (p_event_type = 'all' OR p_event_type = 'emails')
      AND (p_date_from IS NULL OR e.received_at >= p_date_from)
      AND (p_date_to IS NULL OR e.received_at <= p_date_to)

    UNION ALL

    -- Agent Runs
    SELECT 
      'agent_run'::text as kind,
      ar.id,
      ar.created_at as sort_timestamp,
      jsonb_build_object(
        'id', ar.id,
        'createdAt', ar.created_at,
        'agentId', ar.agent_id,
        'actionType', ar.action_type,
        'status', ar.status,
        'clientId', ar.client_id,
        'proposal', ar.output->'proposal'
      ) as data
    FROM agent_runs ar
    WHERE ar.workspace_id = p_workspace_id
      AND ar.client_id = p_client_id
      AND (p_event_type = 'all' OR p_event_type = 'agent_runs')
      AND (p_date_from IS NULL OR ar.created_at >= p_date_from)
      AND (p_date_to IS NULL OR ar.created_at <= p_date_to)
  )
  SELECT t.kind, t.id, t.sort_timestamp, t.data
  FROM timeline t
  WHERE (
    p_cursor_timestamp IS NULL 
    OR (t.sort_timestamp, t.id, t.kind) < (p_cursor_timestamp, p_cursor_id, p_cursor_kind)
  )
  ORDER BY t.sort_timestamp DESC, t.id DESC, t.kind DESC
  LIMIT p_limit;
END;
$$;
