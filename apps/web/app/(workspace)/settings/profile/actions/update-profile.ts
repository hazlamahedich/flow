'use server';

import { updateProfileSchema } from '@flow/types';
import type { ActionResult, UserProfile } from '@flow/types';
import { createFlowError, cacheTag } from '@flow/db';
import { ensureUserProfile, getUserProfile, updateUserProfile } from '@flow/db';
import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';

export async function updateProfile(
  input: unknown,
): Promise<ActionResult<UserProfile>> {
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(
        400,
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Invalid input',
        'validation',
      ),
    };
  }

  const { name, timezone } = parsed.data;
  const supabase = await getServerSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      success: false,
      error: createFlowError(401, 'UNAUTHORIZED', 'Session expired', 'auth'),
    };
  }

  if (!user.email) {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', 'Email is required.', 'validation'),
    };
  }

  try {
    await ensureUserProfile(supabase, user.id, user.email);
    await updateUserProfile(supabase, user.id, { name, timezone });

    revalidateTag(cacheTag('user', user.id));

    const profile = await getUserProfile(supabase, user.id);
    if (!profile) {
      return {
        success: false,
        error: createFlowError(500, 'INTERNAL_ERROR', "Couldn't save changes. Please try again.", 'system'),
      };
    }

    return { success: true, data: profile };
  } catch {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', "Couldn't save changes. Please try again.", 'system'),
    };
  }
}
