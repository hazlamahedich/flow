import type { SupabaseClient } from '@supabase/supabase-js';

interface AtomicEmailChangeResult {
  allowed: boolean;
  wasInserted: boolean;
  pendingExists: boolean;
  pendingNewEmail: string | null;
  requestCount: number;
}

export async function requestEmailChangeAtomic(
  client: SupabaseClient,
  userId: string,
  newEmail: string,
  token: string,
): Promise<AtomicEmailChangeResult> {
  const { data, error } = await client.rpc('request_email_change_atomic', {
    p_user_id: userId,
    p_new_email: newEmail,
    p_token: token,
  });

  if (error) {
    throw new Error(`Atomic email change request failed: ${error.message}`);
  }

  const result = data as {
    request_count?: number;
    was_inserted?: number;
    pending_new_email?: string | null;
    error?: string;
  };

  if (result.error === 'unauthorized') {
    throw new Error('Atomic email change request failed: unauthorized');
  }

  const wasInserted = (result.was_inserted ?? 0) > 0;
  const requestCount = result.request_count ?? 0;

  return {
    allowed: requestCount < 5,
    wasInserted,
    pendingExists: !wasInserted && (result.pending_new_email ?? null) !== null,
    pendingNewEmail: result.pending_new_email ?? null,
    requestCount,
  };
}
