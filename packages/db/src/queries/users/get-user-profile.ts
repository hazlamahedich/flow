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

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    timezone: data.timezone,
    avatarUrl: data.avatar_url,
    updatedAt: data.updated_at,
  };
}
