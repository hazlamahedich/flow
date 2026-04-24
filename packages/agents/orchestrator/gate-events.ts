import type { AgentId, TrustLevel } from '@flow/trust';
import { createServiceClient } from '@flow/db';

export type PreCheckFailedEvent = {
  type: 'gate_pre_check_failed';
  agentId: AgentId;
  actionType: string;
  failedKey: string;
  trustLevel: TrustLevel;
  runId: string;
  timestamp: string;
};

export type PostCheckViolationEvent = {
  type: 'gate_post_check_violation';
  agentId: AgentId;
  actionType: string;
  constraintViolated: string;
  outputRejected: true;
  runId: string;
  timestamp: string;
};

export type GateEvent = PreCheckFailedEvent | PostCheckViolationEvent;

export async function writeGateSignal(
  event: GateEvent,
  runId: string,
  workspaceId: string,
): Promise<string> {
  const client = createServiceClient();
  const { data, error } = await client
    .from('agent_signals')
    .insert({
      correlation_id: runId,
      agent_id: event.agentId,
      signal_type: event.type,
      payload: event as unknown as Record<string, unknown>,
      workspace_id: workspaceId,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}
