'use server';

import type { ActionResult } from '@flow/types';
import { createFlowError, cacheTag } from '@flow/db';
import { getServerSupabase } from '@/lib/supabase-server';
import { revalidateTag } from 'next/cache';

export async function cancelEmailChange(
  _input: unknown,
): Promise<ActionResult<void>> {
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
    .update({ status: 'cancelled' })
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (error) {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', "Couldn't process your request. Please try again.", 'system'),
    };
  }

  if (!data) {
    return {
      success: false,
      error: createFlowError(
        409,
        'EMAIL_CHANGE_ALREADY_APPLIED',
        'Your email has already been changed.',
        'validation',
      ),
    };
  }

  revalidateTag(cacheTag('user', user.id));

  return { success: true, data: undefined };
}
