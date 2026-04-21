import type { SupabaseClient } from '@supabase/supabase-js';

export async function updateAvatarUrl(
  client: SupabaseClient,
  userId: string,
  avatarUrl: string | null,
): Promise<void> {
  const { error } = await client
    .from('users')
    .update({ avatar_url: avatarUrl })
    .eq('id', userId);

  if (error) {
    throw new Error(`Failed to update avatar URL: ${error.message}`);
  }
}
