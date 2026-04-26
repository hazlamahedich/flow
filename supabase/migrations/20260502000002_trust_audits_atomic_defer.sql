-- Atomic defer for trust check-in (Story 2.6c)
-- Prevents TOCTOU race on deferral count

CREATE OR REPLACE FUNCTION defer_trust_checkin(
  p_workspace_id uuid,
  p_agent_id text
)
RETURNS TABLE(success boolean, deferred_count integer, next_checkin timestamptz, pinned boolean)
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_count integer;
  v_new_count integer;
BEGIN
  SELECT deferred_count INTO v_current_count
    FROM trust_audits
    WHERE workspace_id = p_workspace_id AND agent_id = p_agent_id;

  IF NOT FOUND THEN
    INSERT INTO trust_audits (workspace_id, agent_id, deferred_count, last_deferred_at)
      VALUES (p_workspace_id, p_agent_id, 1, now())
      ON CONFLICT (workspace_id, agent_id) DO NOTHING
      RETURNING deferred_count INTO v_new_count;

    IF v_new_count IS NULL THEN
      SELECT deferred_count INTO v_current_count
        FROM trust_audits
        WHERE workspace_id = p_workspace_id AND agent_id = p_agent_id;

      IF v_current_count >= 3 THEN
        RETURN QUERY SELECT false, v_current_count, NULL::timestamptz, true;
        RETURN;
      END IF;

      UPDATE trust_audits
        SET deferred_count = deferred_count + 1, last_deferred_at = now()
        WHERE workspace_id = p_workspace_id AND agent_id = p_agent_id
        RETURNING deferred_count INTO v_new_count;
    END IF;

    RETURN QUERY SELECT true, v_new_count, now() + interval '7 days', false;
    RETURN;
  END IF;

  IF v_current_count >= 3 THEN
    RETURN QUERY SELECT false, v_current_count, NULL::timestamptz, true;
    RETURN;
  END IF;

  UPDATE trust_audits
    SET deferred_count = deferred_count + 1, last_deferred_at = now()
    WHERE workspace_id = p_workspace_id AND agent_id = p_agent_id
    RETURNING deferred_count INTO v_new_count;

  IF v_new_count >= 3 THEN
    RETURN QUERY SELECT true, v_new_count, NULL::timestamptz, true;
  ELSE
    RETURN QUERY SELECT true, v_new_count, now() + interval '7 days', false;
  END IF;
END;
$$;
