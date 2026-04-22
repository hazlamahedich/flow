'use server';

import type { ActionResult } from '@flow/types';
import { createFlowError, cacheTag } from '@flow/db';
import { getServerSupabase } from '@/lib/supabase-server';
import { revalidateTag } from 'next/cache';

interface CancelEmailChangeInput {
  requestId: string;
}

export async function cancelEmailChange(
  input: unknown,
): Promise<ActionResult<void>> {
  const supabase = await getServerSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      success: false,
      error: createFlowError(401, 'UNAUTHORIZED', 'Your session has expired. Please sign in again.', 'auth'),
    };
  }

  const parsed = input as CancelEmailChangeInput;
  if (!parsed?.requestId || typeof parsed.requestId !== 'string') {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', 'Invalid request.', 'validation'),
    };
  }

  const { data, error } = await supabase
    .from('email_change_requests')
    .update({ status: 'cancelled' })
    .eq('id', parsed.requestId)
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
