'use server';

import { requestEmailChangeSchema } from '@flow/types';
import type { ActionResult } from '@flow/types';
import { createFlowError } from '@flow/db';
import { requestEmailChangeAtomic } from '@flow/db';
import { getServerSupabase } from '@/lib/supabase-server';
import { randomUUID } from 'crypto';

export async function requestEmailChange(
  input: unknown,
): Promise<ActionResult<{ pendingEmail: string }>> {
  const parsed = requestEmailChangeSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(
        400,
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Please enter a valid email address.',
        'validation',
      ),
    };
  }

  const { newEmail } = parsed.data;
  const supabase = await getServerSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      success: false,
      error: createFlowError(401, 'UNAUTHORIZED', 'Your session has expired. Please sign in again.', 'auth'),
    };
  }

  if (!user.email) {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', 'Email is required.', 'validation'),
    };
  }

  if (newEmail.toLowerCase() === user.email.toLowerCase()) {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', 'This is already your email address.', 'validation'),
    };
  }

  const token = randomUUID();

  try {
    const result = await requestEmailChangeAtomic(supabase, user.id, newEmail, token);

    if (!result.allowed) {
      return {
        success: false,
        error: createFlowError(
          429,
          'EMAIL_CHANGE_RATE_LIMITED',
          `You've made too many email change requests. Please try again later.`,
          'validation',
        ),
      };
    }

    if (result.pendingExists && result.pendingNewEmail) {
      return {
        success: false,
        error: createFlowError(
          409,
          'EMAIL_CHANGE_PENDING',
          `You already have a pending change to ${result.pendingNewEmail}. Check your inbox or cancel it first.`,
          'validation',
          { pendingEmail: result.pendingNewEmail },
        ),
      };
    }

    if (!result.wasInserted) {
      return {
        success: false,
        error: createFlowError(500, 'INTERNAL_ERROR', "Couldn't process your request. Please try again.", 'system'),
      };
    }
  } catch {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', "Couldn't process your request. Please try again.", 'system'),
    };
  }

  const { error: updateError } = await supabase.auth.updateUser({ email: newEmail });

  if (updateError) {
    await supabase
      .from('email_change_requests')
      .update({ status: 'cancelled' })
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .eq('token', token)
      .maybeSingle();

    if (
      updateError.message?.toLowerCase().includes('email') &&
      (updateError.message?.toLowerCase().includes('registered') ||
        updateError.message?.toLowerCase().includes('already') ||
        updateError.message?.toLowerCase().includes('exists'))
    ) {
      return {
        success: false,
        error: createFlowError(
          409,
          'EMAIL_UNAVAILABLE',
          "This email address isn't available. Please try a different one.",
          'validation',
        ),
      };
    }

    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', "Couldn't process your request. Please try again.", 'system'),
    };
  }

  return {
    success: true,
    data: { pendingEmail: newEmail },
  };
}
