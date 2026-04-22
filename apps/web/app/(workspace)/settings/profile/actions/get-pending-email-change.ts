'use server';

import type { ActionResult, PendingEmailChange } from '@flow/types';
import { createFlowError } from '@flow/db';
import { getServerSupabase } from '@/lib/supabase-server';

export async function getPendingEmailChange(
  _input: unknown,
): Promise<ActionResult<PendingEmailChange>> {
  const supabase = await getServerSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      success: false,
      error: createFlowError(401, 'UNAUTHORIZED', 'Your session has expired. Please sign in again.', 'auth'),
    };
  }

  const { data, error } = await supabase
    .from('email_change_requests')
    .select('new_email, expires_at')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error) {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', "Couldn't load email change status.", 'system'),
    };
  }

  if (!data) {
    return {
      success: true,
      data: { pending: false, newEmail: null, expiresAt: null },
    };
  }

  return {
    success: true,
    data: {
      pending: true,
      newEmail: data.new_email,
      expiresAt: data.expires_at,
    },
  };
}
