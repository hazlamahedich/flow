import type { AgentId } from '@flow/trust';
import type { FlowError } from '@flow/types';
import type { OutputSchemaRegistry } from './output-schemas';
import type { TrustClient } from '@flow/trust';
import { writeAuditLog } from '../shared/audit-writer';
import { TrustTransitionError } from '@flow/trust';
import { getRunById, createServiceClient } from '@flow/db';

export type PostCheckResult =
  | { valid: true }
  | { valid: false; error: FlowError; zodErrors: string };

export async function runPostCheck(
  agentId: AgentId,
  actionType: string,
  output: unknown,
  registry: OutputSchemaRegistry,
  runId: string,
  workspaceId: string,
  trustClient: TrustClient,
): Promise<PostCheckResult> {
  const schema = registry.get(agentId, actionType);
  if (!schema) {
    writeAuditLog({
      workspaceId,
      agentId,
      action: 'gate.post_check.unregistered',
      entityType: 'agent_run',
      entityId: runId,
      details: { actionType, outcome: 'warn_unregistered' },
    });
    return { valid: true };
  }

  const result = schema.safeParse(output);
  if (result.success) {
    return { valid: true };
  }

  const zodSummary = result.error.issues
    .map((i) => `${i.path.join('.')}: ${i.message}`)
    .join('; ');

  const error: FlowError = {
    status: 422,
    code: 'AGENT_OUTPUT_REJECTED',
    message: `Output validation failed: ${zodSummary}`,
    category: 'agent',
    agentType: agentId,
    details: {
      constraintViolated: zodSummary,
      outputRejected: true,
      runId,
      timestamp: new Date().toISOString(),
    },
  };

  const run = await getRunById(runId);
  const snapshotId = run.trust_snapshot_id;
  if (snapshotId) {
    const alreadyRecorded = await checkViolationRecorded(runId);
    if (alreadyRecorded) {
      writeAuditLog({
        workspaceId, agentId, action: 'gate.post_check.violation_idempotent_skip',
        entityType: 'agent_run', entityId: runId,
        details: { outcome: 'skip_duplicate_violation' },
      });
    } else {
      try {
        await trustClient.recordViolation(snapshotId, 'hard');
      } catch (err) {
        if (!(err instanceof TrustTransitionError && err.code === 'CONCURRENT_MODIFICATION')) {
          writeAuditLog({
            workspaceId, agentId, action: 'gate.post_check.record_violation_error',
            entityType: 'agent_run', entityId: runId,
            details: { error: err instanceof Error ? err.message : String(err) },
          });
        }
      }
    }
  } else {
    writeAuditLog({
      workspaceId,
      agentId,
      action: 'gate.post_check.no_snapshot',
      entityType: 'agent_run',
      entityId: runId,
      details: { outcome: 'violation_skip_no_snapshot' },
    });
  }

  return { valid: false, error, zodErrors: zodSummary };
}

async function checkViolationRecorded(runId: string): Promise<boolean> {
  try {
    const client = createServiceClient();
    const { data } = await client
      .from('agent_signals')
      .select('id')
      .eq('correlation_id', runId)
      .eq('signal_type', 'gate_post_check_violation')
      .maybeSingle();
    return data !== null;
  } catch {
    return false;
  }
}
