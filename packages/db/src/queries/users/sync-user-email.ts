import type { SupabaseClient } from '@supabase/supabase-js';

export async function syncUserEmail(
  client: SupabaseClient,
  userId: string,
  email: string,
): Promise<void> {
  const { error } = await client
    .from('users')
    .update({ email })
    .eq('id', userId);

  if (error) {
    throw new Error(`Failed to sync user email: ${error.message}`);
  }
}
