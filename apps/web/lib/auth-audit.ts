import { getServerSupabase } from '@/lib/supabase-server';
import { createHmac } from 'node:crypto';

type AuthAction =
  | 'magic_link_requested'
  | 'magic_link_sent'
  | 'magic_link_verified'
  | 'session_created'
  | 'session_revoked'
  | 'rate_limit_triggered'
  | 'link_expired_attempt';

function hmacSha256(value: string): string {
  const secret = process.env.AUTH_HMAC_SECRET ?? 'dev-secret-change-in-production';
  return createHmac('sha256', secret).update(value).digest('hex');
}

interface LogAuthEventParams {
  action: AuthAction;
  email?: string;
  ip?: string;
  userId?: string;
  outcome: 'success' | 'failure';
  details?: Record<string, unknown>;
}

export async function logAuthEvent(params: LogAuthEventParams): Promise<void> {
  try {
    const supabase = await getServerSupabase();

    const eventDetails: Record<string, unknown> = {
      outcome: params.outcome,
      ...params.details,
    };

    if (params.email) {
      eventDetails.email_hmac = hmacSha256(params.email);
    }
    if (params.ip) {
      eventDetails.ip_hmac = hmacSha256(params.ip);
    }

    await supabase.from('audit_log').insert({
      workspace_id: null,
      user_id: params.userId ?? null,
      action: params.action,
      entity_type: 'auth',
      details: eventDetails,
    });
  } catch (err) {
    console.error('Failed to log auth event:', err);
  }
}
