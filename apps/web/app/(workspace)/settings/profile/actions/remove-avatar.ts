'use server';

import type { ActionResult } from '@flow/types';
import { createFlowError, cacheTag } from '@flow/db';
import { ensureUserProfile, updateAvatarUrl } from '@flow/db';
import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';

export async function removeAvatar(): Promise<ActionResult<void>> {
  const supabase = await getServerSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      success: false,
      error: createFlowError(
        401,
        'UNAUTHORIZED',
        'Your session has expired. Please sign in again.',
        'auth',
      ),
    };
  }

  try {
    await ensureUserProfile(supabase, user.id, user.email ?? '');

    const { data: currentProfile } = await supabase
      .from('users')
      .select('avatar_url')
      .eq('id', user.id)
      .single();

    if (currentProfile?.avatar_url) {
      const oldPath = currentProfile.avatar_url;
      const pathMatch = oldPath.match(/\/avatars\/(.+?\.\w+)/);
      if (pathMatch) {
        await supabase.storage.from('avatars').remove([`/${user.id}/${pathMatch[1]}`]);
      }
    }

    await updateAvatarUrl(supabase, user.id, null);
    revalidateTag(cacheTag('user', user.id));

    return { success: true, data: undefined };
  } catch {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', "Couldn't remove avatar. Please try again.", 'system'),
    };
  }
}
