CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier text,
  p_action text DEFAULT 'magic_link_request',
  p_max_requests integer DEFAULT 5,
  p_window_seconds integer DEFAULT 3600,
  p_min_interval_seconds integer DEFAULT 15
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing record;
  v_request_count integer;
  v_result jsonb;
BEGIN
  SELECT request_count, window_start, last_request_at
  INTO v_existing
  FROM rate_limits
  WHERE identifier = p_identifier AND action = p_action;

  IF v_existing IS NOT NULL THEN
    IF v_existing.window_start < now() - (p_window_seconds || ' seconds')::interval THEN
      v_request_count := 1;
    ELSE
      v_request_count := v_existing.request_count + 1;
    END IF;

    IF v_request_count > p_max_requests THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'retry_after_ms', EXTRACT(EPOCH FROM (v_existing.window_start + (p_window_seconds || ' seconds')::interval - now())) * 1000
      );
    END IF;

    IF p_min_interval_seconds > 0
       AND v_existing.last_request_at IS NOT NULL
       AND (now() - v_existing.last_request_at) < (p_min_interval_seconds || ' seconds')::interval THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'retry_after_ms', (p_min_interval_seconds - EXTRACT(EPOCH FROM (now() - v_existing.last_request_at))) * 1000
      );
    END IF;
  ELSE
    v_request_count := 1;
  END IF;

  INSERT INTO rate_limits (identifier, action, request_count, window_start, last_request_at)
  VALUES (p_identifier, p_action, v_request_count,
          CASE WHEN v_existing IS NULL OR v_existing.window_start < now() - (p_window_seconds || ' seconds')::interval
               THEN now() ELSE v_existing.window_start END,
          now())
  ON CONFLICT (identifier, action)
  DO UPDATE SET
    request_count = v_request_count,
    window_start = CASE WHEN v_existing.window_start < now() - (p_window_seconds || ' seconds')::interval
                        THEN now() ELSE v_existing.window_start END,
    last_request_at = now(),
    updated_at = now();

  RETURN jsonb_build_object('allowed', true, 'retry_after_ms', 0);
END;
$$;
