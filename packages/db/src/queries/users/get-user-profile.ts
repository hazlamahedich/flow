import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserProfile } from '@flow/types';

export async function getUserProfile(
  client: SupabaseClient,
  userId: string,
): Promise<UserProfile | null> {
  const { data, error } = await client
    .from('users')
    .select('id, name, email, timezone, avatar_url, updated_at')
    .eq('id', userId)
    .single();

  if (error) return null;
  if (!data) return null;

  let avatarUrl: string | null = data.avatar_url;
  if (avatarUrl && !avatarUrl.startsWith('http')) {
    const { data: signedData } = await client.storage
      .from('avatars')
      .createSignedUrl(avatarUrl, 3600);
    avatarUrl = signedData?.signedUrl ?? null;
  }

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    timezone: data.timezone,
    avatarUrl,
    updatedAt: data.updated_at,
  };
}
