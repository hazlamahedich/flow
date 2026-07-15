/**
 * Story 9.5b AC1 — Subscription-pause guard helper (extracted from
 * `pg-boss-worker.ts` to keep that file under the 200-line soft limit).
 *
 * Implements the guard clause that releases jobs back to the queue via
 * `boss.fail(retryable)`, cancels the queued `agent_runs` row, writes the
 * audit log, and emits the 3-dotted `agent_signals` row.
 *
 * Pure-ish: takes injected clients + payload + a logger so it's testable in
 * isolation without instantiating `PgBossWorker`.
 */
import type { PgBoss, Job } from 'pg-boss';
import { createServiceClient, cancelRun, getWorkspaceSubscriptionStatus } from '@flow/db';
import { shouldDequeueForWorkspace } from '@flow/shared';
import { writeAuditLog } from '../shared/audit-writer';
import type { AgentJobPayload } from './schemas';

/**
 * Subscription-pause retry schedule (FR60).
 *
 * D3 decision: pg-boss `boss.fail()` accepts a single `retryDelay` number
 * plus `retryBackoff` (exponential doubling), not an array. We use a 60s
 * base delay so the sequence is ~1m, 2m, 4m, 8m, 16m — frequent early,
 * sparse late. Payment recovery typically resolves in <1h.
 */
export const SUBSCRIPTION_PAUSED_RETRY_OPTIONS = {
  retryDelay: 60,
  retryBackoff: true,
} as const;

/**
 * Signal type emitted when a job claim is released due to a paused
 * subscription. MUST be 3-dotted to satisfy the `agent_signals.signal_type`
 * CHECK constraint `^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$`
 * (migration `20260525000000_agent_signals_dedup_and_constraint_fix.sql`).
 */
export const SUBSCRIPTION_PAUSED_SIGNAL_TYPE = 'claim.subscription.paused';

/**
 * Returns `true` when the orchestrator should release the job and skip the
 * claim (workspace is paused). Performs all side-effects (boss.fail,
 * cancelRun, audit log, agent_signals) and returns whether the caller
 * should bail out.
 *
 * EC5: defensive null check when workspaceId missing → bail out with
 * MISSING_WORKSPACE. The schema-level UUID check catches malformed inputs
 * before this; the guard is a defence-in-depth.
 * EC6: jobs already `running` when status transitions complete are
 *      unaffected (guard only intercepts NEW claims).
 */
export async function releaseIfSubscriptionPaused(
  boss: PgBoss,
  payload: AgentJobPayload,
  job: Job<unknown>,
): Promise<boolean> {
  // EC5 — missing workspaceId (defence-in-depth; schema catches first).
  if (!payload.workspaceId) {
    writeAuditLog({
      workspaceId: '', agentId: payload.agentId,
      action: 'claim.missing_workspace', entityType: 'agent_run',
      entityId: payload.runId, details: { jobId: job.id, outcome: 'released' },
    });
    try {
      await boss.fail(`agent:${payload.agentId}`, job.id, {
        retryable: false,
        code: 'MISSING_WORKSPACE',
        message: 'AgentJobPayload.workspaceId missing',
      });
    } catch (failErr) {
      // Non-fatal, but audit the failure so ops can see stuck jobs.
      writeAuditLog({
        workspaceId: '', agentId: payload.agentId,
        action: 'claim.missing_workspace.fail_error', entityType: 'agent_run',
        entityId: payload.runId,
        details: { jobId: job.id, error: failErr instanceof Error ? failErr.message : String(failErr) },
      });
    }
    return true;
  }

  const subscriptionStatus = await getWorkspaceSubscriptionStatus(payload.workspaceId);
  if (subscriptionStatus !== null && shouldDequeueForWorkspace(subscriptionStatus)) {
    return false; // proceed with the claim
  }

  // Paused — release + cancel + audit + signal.
  const reason = `Workspace ${payload.workspaceId} subscription_status=${subscriptionStatus ?? 'unknown'}`;
  writeAuditLog({
    workspaceId: payload.workspaceId,
    agentId: payload.agentId,
    action: 'claim.subscription_paused',
    entityType: 'agent_run',
    entityId: payload.runId,
    details: { jobId: job.id, subscriptionStatus, outcome: 'released' },
  });

  let failError: Error | undefined;
  try {
    await boss.fail(`agent:${payload.agentId}`, job.id, {
      retryable: true,
      code: 'SUBSCRIPTION_PAUSED',
      message: reason,
      ...SUBSCRIPTION_PAUSED_RETRY_OPTIONS,
    });
  } catch (err) {
    failError = err instanceof Error ? err : new Error(String(err));
  }

  let cancelError: Error | undefined;
  try {
    await cancelRun(payload.runId, reason);
  } catch (err) {
    cancelError = err instanceof Error ? err : new Error(String(err));
  }

  let signalError: Error | undefined;
  try {
    const client = createServiceClient();
    await client.from('agent_signals').insert({
      correlation_id: payload.correlationId,
      agent_id: payload.agentId,
      signal_type: SUBSCRIPTION_PAUSED_SIGNAL_TYPE,
      payload: {
        subscriptionStatus,
        runId: payload.runId,
        jobId: job.id,
        outcome: 'released',
      } as unknown as Record<string, unknown>,
      workspace_id: payload.workspaceId,
    });
  } catch (err) {
    signalError = err instanceof Error ? err : new Error(String(err));
  }

  // Re-audit if any side-effect failed so the failure is not silent.
  if (failError || cancelError || signalError) {
    writeAuditLog({
      workspaceId: payload.workspaceId,
      agentId: payload.agentId,
      action: 'claim.subscription_paused.side_effect_warning',
      entityType: 'agent_run',
      entityId: payload.runId,
      details: {
        jobId: job.id,
        subscriptionStatus,
        failError: failError?.message,
        cancelError: cancelError?.message,
        signalError: signalError?.message,
      },
    });
  }

  return true;
}
