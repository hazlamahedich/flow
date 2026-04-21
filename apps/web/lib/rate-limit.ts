import { getServerSupabase } from '@/lib/supabase-server';

interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  minIntervalMs: number;
}

const MAGIC_LINK_REQUEST_CONFIG: RateLimitConfig = {
  maxRequests: 5,
  windowMs: 60 * 60 * 1000,
  minIntervalMs: 15 * 1000,
};

const MAGIC_LINK_VERIFICATION_CONFIG: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 60 * 60 * 1000,
  minIntervalMs: 0,
};

export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = MAGIC_LINK_REQUEST_CONFIG,
): Promise<RateLimitResult> {
  try {
    const supabase = await getServerSupabase();

    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_identifier: identifier,
      p_action: config === MAGIC_LINK_VERIFICATION_CONFIG ? 'magic_link_verification' : 'magic_link_request',
      p_max_requests: config.maxRequests,
      p_window_seconds: config.windowMs / 1000,
      p_min_interval_seconds: config.minIntervalMs / 1000,
    });

    if (error) {
      console.warn('Rate limit check failed, allowing request through:', error.message);
      return { allowed: true, retryAfterMs: 0 };
    }

    const result = data as { allowed: boolean; retry_after_ms: number } | null;
    if (!result) {
      return { allowed: true, retryAfterMs: 0 };
    }

    return {
      allowed: result.allowed,
      retryAfterMs: result.retry_after_ms,
    };
  } catch (err) {
    console.warn('Rate limit check failed, allowing request through:', err);
    return { allowed: true, retryAfterMs: 0 };
  }
}

export { MAGIC_LINK_VERIFICATION_CONFIG };
