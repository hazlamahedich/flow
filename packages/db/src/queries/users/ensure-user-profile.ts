import type { SupabaseClient } from '@supabase/supabase-js';

export async function ensureUserProfile(
  client: SupabaseClient,
  userId: string,
  email: string,
): Promise<void> {
  const { error } = await client.from('users').upsert(
    { id: userId, email, timezone: 'UTC' },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (error) {
    throw new Error(`Failed to ensure user profile: ${error.message}`);
  }
}
