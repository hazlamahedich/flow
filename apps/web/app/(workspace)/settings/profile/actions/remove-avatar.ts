'use server';

import type { ActionResult } from '@flow/types';
import { createFlowError, cacheTag } from '@flow/db';
import { ensureUserProfile, updateAvatarUrl } from '@flow/db';
import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';

function extractStoragePath(avatarUrl: string, userId: string): string | null {
  const match = avatarUrl.match(new RegExp(`${userId}/[^/]+\\.\\w+`));
  return match ? match[0] : null;
}

export async function removeAvatar(): Promise<ActionResult<void>> {
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

    const { data: currentProfile } = await supabase
      .from('users')
      .select('avatar_url')
      .eq('id', user.id)
      .single();

    if (currentProfile?.avatar_url) {
      const oldStoragePath = extractStoragePath(currentProfile.avatar_url, user.id);
      if (oldStoragePath) {
        const { error: removeError } = await supabase.storage.from('avatars').remove([oldStoragePath]);
        if (removeError) {
          console.error('Failed to delete avatar file:', removeError.message);
        }
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
