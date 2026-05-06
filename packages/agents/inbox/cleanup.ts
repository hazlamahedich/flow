import { createServiceClient } from '@flow/db';

/**
 * Deletes processed raw Pub/Sub payloads older than the specified TTL.
 * Task 7.1
 */
export async function cleanupRawPayloads(ttlDays: number = 7) {
  const supabase = createServiceClient();
  const threshold = new Date();
  threshold.setDate(threshold.getDate() - ttlDays);

  const { count, error } = await supabase
    .from('raw_pubsub_payloads')
    .delete({ count: 'exact' })
    .eq('processed', true)
    .lt('created_at', threshold.toISOString());

  if (error) {
    console.error('Failed to cleanup raw payloads:', error);
    throw error;
  }

  return count || 0;
}
