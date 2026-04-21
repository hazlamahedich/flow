import type { SupabaseClient } from '@supabase/supabase-js';

export async function updateUserProfile(
  client: SupabaseClient,
  userId: string,
  data: { name: string; timezone: string },
): Promise<void> {
  const { error } = await client
    .from('users')
    .update({ name: data.name, timezone: data.timezone })
    .eq('id', userId);

  if (error) {
    throw new Error(`Failed to update user profile: ${error.message}`);
  }
}
