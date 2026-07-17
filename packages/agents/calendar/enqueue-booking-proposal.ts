import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgentRunProducer } from '../orchestrator/types.js';

export interface EnqueueBookingProposalParams {
  supabase: SupabaseClient;
  producer: AgentRunProducer;
  workspaceId: string;
  schedulingRequestId: string;
  clientId?: string | null;
}

const DEDUP_WINDOW_MS = 5 * 60 * 1000;

export async function enqueueBookingProposal(
  params: EnqueueBookingProposalParams,
): Promise<void> {
  const { producer, workspaceId, schedulingRequestId, clientId } = params;
  const windowBucket = Math.floor(Date.now() / DEDUP_WINDOW_MS);
  const idempotencyKey = `booking-proposal:${schedulingRequestId}:${windowBucket}`;

  await producer.submit({
    agentId: 'calendar',
    actionType: 'proposeBooking',
    input: { workspace_id: workspaceId, schedulingRequestId } as Record<
      string,
      unknown
    >,
    ...(clientId ? { clientId } : {}),
    idempotencyKey,
  });
}
