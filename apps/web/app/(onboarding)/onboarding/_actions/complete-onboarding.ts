'use server';

import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext } from '@flow/db';
import type { ActionResult } from '@flow/types';

export async function completeOnboarding(): Promise<ActionResult<void>> {
  const supabase = await getServerSupabase();

  let userId: string;
  try {
    const ctx = await requireTenantContext(supabase);
    userId = ctx.userId;
  } catch {
    return {
      success: false,
      error: {
        status: 401,
        code: 'AUTH_REQUIRED',
        message: 'Authentication required',
        category: 'auth',
      },
    };
  }

  const { error } = await supabase
    .from('users')
    .update({ completed_onboarding: true })
    .eq('id', userId);

  if (error) {
    return {
      success: false,
      error: {
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'Failed to complete onboarding',
        category: 'system',
      },
    };
  }

  revalidateTag('profile');
  return { success: true, data: undefined };
}
