import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgentRunProducer } from '../orchestrator/types.js';

/** Parameters for enqueuing a conflict detection job. */
export interface EnqueueConflictDetectionParams {
  supabase: SupabaseClient;
  producer: AgentRunProducer;
  workspaceId: string;
  eventId: string;
  clientCalendarId: string;
  clientId?: string | null;
}

/** 5-minute deduplication window in milliseconds. */
const DEDUP_WINDOW_MS = 5 * 60 * 1000;

/**
 * Enqueue a conflict detection job for a newly synced event.
 *
 * Uses an idempotency key of the form:
 *   conflict-detect:{eventId}:{floor(now / 300000)}
 *
 * This provides 5-minute deduplication — if the same event triggers
 * multiple syncs within 5 minutes, only one conflict detection runs.
 * The producer's submit() handles 23505 gracefully via idempotency key lookup.
 */
export async function enqueueConflictDetection(
  params: EnqueueConflictDetectionParams,
): Promise<void> {
  const { producer, workspaceId, eventId, clientCalendarId, clientId } = params;

  const windowBucket = Math.floor(Date.now() / DEDUP_WINDOW_MS);
  const idempotencyKey = `conflict-detect:${eventId}:${windowBucket}`;

  await producer.submit({
    agentId: 'calendar',
    actionType: 'detectConflict',
    input: {
      workspace_id: workspaceId,
      eventId,
      clientCalendarId,
    } as Record<string, unknown>,
    ...(clientId ? { clientId } : {}),
    idempotencyKey,
  });
}
