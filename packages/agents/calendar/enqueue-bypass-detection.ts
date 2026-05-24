import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgentRunProducer } from '../orchestrator/types.js';

export interface EnqueueBypassDetectionParams {
  supabase: SupabaseClient;
  producer: AgentRunProducer;
  workspaceId: string;
  eventId: string;
  clientId: string;
  eventCreatedAt: string;
}

const DEDUP_WINDOW_MS = 5 * 60 * 1000;

export async function enqueueBypassDetection(
  params: EnqueueBypassDetectionParams,
): Promise<void> {
  const { producer, workspaceId, eventId, clientId, eventCreatedAt } = params;

  const windowBucket = Math.floor(Date.now() / DEDUP_WINDOW_MS);
  const idempotencyKey = `bypass-detect:${eventId}:${windowBucket}`;

  await producer.submit({
    agentId: 'calendar',
    actionType: 'detectBypass',
    input: {
      workspace_id: workspaceId,
      eventId,
      clientId,
      eventCreatedAt,
    } as Record<string, unknown>,
    idempotencyKey,
  });
}
