'use server';

import type { ActionResult } from '@flow/types';
import { createFlowError, cacheTag } from '@flow/db';
import { ensureUserProfile, updateAvatarUrl } from '@flow/db';
import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';
import { validateImageMagicBytes } from '@/lib/validate-image';

export async function uploadAvatar(
  formData: FormData,
): Promise<ActionResult<{ avatarUrl: string }>> {
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

  const file = formData.get('avatar');
  if (!file || !(file instanceof File)) {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', 'Avatar must be a JPEG, PNG, or WebP image.', 'validation'),
    };
  }

  if (file.size > 2 * 1024 * 1024) {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', 'Avatar must be smaller than 2MB.', 'validation'),
    };
  }

  const buffer = await file.arrayBuffer();
  const magicResult = validateImageMagicBytes(buffer);

  if (!magicResult.valid) {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', 'Avatar must be a JPEG, PNG, or WebP image.', 'validation'),
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

    const ext = magicResult.mimeType.split('/')[1];
    const timestamp = Date.now();
    const random = crypto.randomUUID().slice(0, 8);
    const storagePath = `${user.id}/${timestamp}-${random}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(storagePath, file, {
        contentType: magicResult.mimeType,
        upsert: false,
      });

    if (uploadError) {
      return {
        success: false,
        error: createFlowError(500, 'INTERNAL_ERROR', "Couldn't upload avatar. Please try again.", 'system'),
      };
    }

    const { data: signedUrlData } = await supabase.storage
      .from('avatars')
      .createSignedUrl(storagePath, 3600);

    const avatarUrl = signedUrlData?.signedUrl ?? storagePath;
    await updateAvatarUrl(supabase, user.id, avatarUrl);

    revalidateTag(cacheTag('user', user.id));

    return { success: true, data: { avatarUrl } };
  } catch {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', "Couldn't upload avatar. Please try again.", 'system'),
    };
  }
}
