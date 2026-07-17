import {
  createServiceClient,
  getAgentConfiguration,
  insertRun,
} from '@flow/db';
import type { ActionResult } from '@flow/types';
import type { TrustClient } from '@flow/trust';
import { writeAuditLog } from '../shared/audit-writer';
import {
  detectGaps,
  detectOverlaps,
  detectLowHours,
  type TimeEntryForDetection,
} from './anomaly-detection';
import {
  GAP_THRESHOLD_MINUTES,
  LOW_HOURS_TARGET,
  type TimeIntegrityInput,
  type SweepResult,
  type AnomalySignal,
} from './schemas';
import {
  buildProposalTitle,
  subtractDays,
  PROPOSAL_REASONING,
} from './executor-helpers';

export interface SweepDeps {
  trustClient?: TrustClient | undefined;
}

export function mapRawEntryToDetection(
  r: Record<string, unknown>,
): TimeEntryForDetection {
  return {
    id: r.id as string,
    date: r.date as string,
    durationMinutes: r.duration_minutes as number,
    ...(r.start_minutes != null && { startMinutes: r.start_minutes as number }),
    ...(r.end_minutes != null && { endMinutes: r.end_minutes as number }),
  };
}

// Guard against Supabase's 1000-row default truncation; audit-logged on cap hit (P0)
const ENTRY_FETCH_LIMIT = 5000;

/** Executes the time integrity sweep for one workspace on one sweep date.
 *  AC9: Returns immediately with zero DB writes if agent is not active.
 *  AC10: Throws if workspaceId is null/undefined (RLS isolation). */
export async function execute(
  input: TimeIntegrityInput,
  deps?: SweepDeps,
): Promise<ActionResult<SweepResult>> {
  const { workspaceId, sweepDate } = input;

  // AC10: application-layer isolation guard — must be first (P7)
  if (!workspaceId) {
    throw new Error(
      'time-integrity.execute: workspaceId must not be null or undefined',
    );
  }

  const client = createServiceClient();

  // P15: warn when no trust client — AC6 trust check will be bypassed
  if (!deps?.trustClient) {
    writeAuditLog({
      workspaceId,
      agentId: 'time-integrity',
      action: 'sweep.trust_client.missing',
      entityType: 'workspace',
      entityId: workspaceId,
      details: {
        note: 'no trustClient injected; signals default to supervised without trust check (AC6 bypass)',
      },
    });
  }

  // AC9: check agent activation
  const config = await getAgentConfiguration(workspaceId, 'time-integrity');
  if (!config || config.status !== 'active') {
    writeAuditLog({
      workspaceId,
      agentId: 'time-integrity',
      action: 'sweep.skipped',
      entityType: 'workspace',
      entityId: workspaceId,
      details: { reason: 'agent_not_active', sweepDate },
    });
    return { success: true, data: { signalsCreated: 0, skippedDuplicates: 0 } };
  }

  // Fetch time entries for a 30-day window ending at sweepDate (workspace-scoped — AC10)
  const windowStart = subtractDays(sweepDate, 30);
  const { data: rawEntries, error: fetchError } = await client
    .from('time_entries')
    .select('id, date, duration_minutes, start_minutes, end_minutes')
    .eq('workspace_id', workspaceId)
    .is('deleted_at', null)
    .gte('date', windowStart)
    .lte('date', sweepDate)
    .limit(ENTRY_FETCH_LIMIT);

  if (fetchError) {
    return {
      success: false,
      error: {
        status: 500,
        code: 'INTERNAL_ERROR',
        message: fetchError.message,
        category: 'system',
      },
    };
  }

  if ((rawEntries?.length ?? 0) >= ENTRY_FETCH_LIMIT) {
    writeAuditLog({
      workspaceId,
      agentId: 'time-integrity',
      action: 'sweep.entries.cap_hit',
      entityType: 'workspace',
      entityId: workspaceId,
      details: {
        sweepDate,
        entriesCapped: ENTRY_FETCH_LIMIT,
        note: 'sweep may be incomplete; pagination needed',
      },
    });
  }

  const entries: TimeEntryForDetection[] = (rawEntries ?? []).map(
    mapRawEntryToDetection,
  );

  // AC3: run all three detectors
  const allSignals: AnomalySignal[] = [
    ...detectGaps(entries, GAP_THRESHOLD_MINUTES),
    ...detectOverlaps(entries),
    ...detectLowHours(entries, LOW_HOURS_TARGET),
  ];

  const executionId = crypto.randomUUID();
  let signalsCreated = 0;
  let skippedDuplicates = 0;

  for (const signal of allSignals) {
    const rawSignalDate = signal.payload.date as string | undefined;
    if (!rawSignalDate) {
      writeAuditLog({
        workspaceId,
        agentId: 'time-integrity',
        action: 'sweep.signal.missing_date',
        entityType: 'workspace',
        entityId: workspaceId,
        details: {
          anomalyType: signal.anomalyType,
          signalKey: signal.signalKey,
          fallback: sweepDate,
        },
      });
    }
    const signalDate = rawSignalDate ?? sweepDate;

    // AC6: resolve autonomy level via trust matrix
    let trustLevel: 'supervised' | 'confirm' | 'auto' = 'supervised';
    let trustSnapshotId: string | undefined;

    if (deps?.trustClient) {
      try {
        const decision = await deps.trustClient.canAct(
          'time-integrity',
          'flag-anomaly',
          workspaceId,
          executionId,
          { anomalyType: signal.anomalyType },
        );
        if (!decision.allowed) {
          writeAuditLog({
            workspaceId,
            agentId: 'time-integrity',
            action: 'sweep.signal.precondition_failed',
            entityType: 'workspace',
            entityId: workspaceId,
            details: {
              anomalyType: signal.anomalyType,
              failedKey: decision.failedPreconditionKey,
            },
          });
          continue;
        }
        trustLevel = decision.level;
        trustSnapshotId = decision.snapshotId;
      } catch (err: unknown) {
        writeAuditLog({
          workspaceId,
          agentId: 'time-integrity',
          action: 'sweep.trust_client.error',
          entityType: 'workspace',
          entityId: workspaceId,
          details: { error: err instanceof Error ? err.message : String(err) },
        });
        trustLevel = 'supervised';
      }
    }

    // AC4 + AC8: upsert signal
    // R2-P3: low-hours signals update payload on conflict (entries may have been added/removed)
    const isLowHours = signal.anomalyType === 'low-hours';
    const insertPayload: Record<string, unknown> = {
      workspace_id: workspaceId,
      sweep_date: signalDate,
      anomaly_type: signal.anomalyType,
      affected_entry_ids: signal.affectedEntryIds,
      signal_key: signal.signalKey,
      payload: signal.payload,
    };
    if (trustLevel === 'auto') {
      insertPayload.resolved_at = new Date().toISOString();
    }

    const { data: upserted, error: upsertError } = await client
      .from('time_integrity_signals')
      .upsert(insertPayload, {
        onConflict: 'workspace_id,sweep_date,signal_key',
        ignoreDuplicates: !isLowHours,
      })
      .select('id')
      .maybeSingle();

    if (upsertError) {
      writeAuditLog({
        workspaceId,
        agentId: 'time-integrity',
        action: 'sweep.signal.upsert_error',
        entityType: 'workspace',
        entityId: workspaceId,
        details: { error: upsertError.message, signalKey: signal.signalKey },
      });
      continue;
    }

    if (!upserted) {
      skippedDuplicates++;
      continue;
    }

    // AC5: surface in TriageInbox for supervised/confirm trust levels
    // P12: signalsCreated incremented only after both signal row AND run are created
    if (trustLevel !== 'auto') {
      try {
        await insertRun({
          workspaceId,
          agentId: 'time-integrity',
          jobId: `signal:${upserted.id as string}`,
          actionType: 'flag-anomaly',
          status: 'waiting_approval',
          input: {
            signal_id: upserted.id,
            anomaly_type: signal.anomalyType,
            affected_entry_ids: signal.affectedEntryIds,
            sweep_date: signalDate,
          },
          output: {
            title: buildProposalTitle(signal),
            confidence: 0.9,
            riskLevel: 'low',
            reasoning: PROPOSAL_REASONING[signal.anomalyType],
          },
          correlationId: executionId,
          trustTierAtExecution: trustLevel,
          trustSnapshotId: trustSnapshotId ?? null,
        });
        signalsCreated++;
      } catch (runErr: unknown) {
        // R2-P2: orphaned signal — mark dismissed so it doesn't surface as unactionable
        writeAuditLog({
          workspaceId,
          agentId: 'time-integrity',
          action: 'sweep.run.create_error',
          entityType: 'workspace',
          entityId: workspaceId,
          details: { error: String(runErr), signalId: upserted.id },
        });
        try {
          await client
            .from('time_integrity_signals')
            .update({ dismissed_at: new Date().toISOString() })
            .eq('id', upserted.id);
        } catch (dismissErr: unknown) {
          writeAuditLog({
            workspaceId,
            agentId: 'time-integrity',
            action: 'sweep.signal.dismiss_error',
            entityType: 'workspace',
            entityId: workspaceId,
            details: { error: String(dismissErr), signalId: upserted.id },
          });
        }
      }
    } else {
      // auto trust: signal resolved immediately, no run needed
      signalsCreated++;
    }
  }

  writeAuditLog({
    workspaceId,
    agentId: 'time-integrity',
    action: 'sweep.complete',
    entityType: 'workspace',
    entityId: workspaceId,
    details: {
      sweepDate,
      signalsCreated,
      skippedDuplicates,
      entriesAnalyzed: entries.length,
    },
  });

  return { success: true, data: { signalsCreated, skippedDuplicates } };
}
