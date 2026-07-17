'use server';

import {
  requireTenantContext,
  createServiceClient,
  createFlowError,
} from '@flow/db';
import { revalidateTag } from 'next/cache';
import type { ActionResult } from '@flow/types';
import { z } from 'zod';

const dismissSignalSchema = z.object({
  signalId: z.string().uuid(),
  runId: z.string().uuid().optional(),
});

// P3+P4: return both workspaceId and the authenticated client to avoid creating two clients
async function getTenantContext() {
  const { createServerClient } = await import('@flow/db');
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const userClient = createServerClient({
    getAll: () =>
      cookieStore.getAll().map((c: { name: string; value: string }) => ({
        name: c.name,
        value: c.value,
      })),
    set: () => {},
  });
  const ctx = await requireTenantContext(userClient);
  return { workspaceId: ctx.workspaceId, userClient };
}

/**
 * Dismisses a time integrity signal.
 * Sets dismissed_at on the signal row (soft-delete; signal retained for audit).
 * Also cancels the linked agent_run proposal if runId is provided.
 */
export async function dismissIntegritySignal(
  input: unknown,
): Promise<ActionResult<{ signalId: string }>> {
  const parsed = dismissSignalSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(
        400,
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Invalid input',
        'validation',
      ),
    };
  }

  const { workspaceId } = await getTenantContext();
  // Writes require service role (RLS INSERT/UPDATE is service_role only per migration)
  const client = createServiceClient();

  // Update signal dismissed_at — workspace_id guard ensures cross-tenant isolation
  const { count, error: sigError } = await client
    .from('time_integrity_signals')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', parsed.data.signalId)
    .eq('workspace_id', workspaceId)
    .is('dismissed_at', null);

  if (sigError) {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', sigError.message, 'system'),
    };
  }

  if (count === 0) {
    return {
      success: false,
      error: createFlowError(
        404,
        'NOT_FOUND',
        'Signal not found, already dismissed, or not in your workspace',
        'validation',
      ),
    };
  }

  // P2: cancel the linked agent_run proposal (best-effort, but log failure)
  if (parsed.data.runId) {
    const { error: runError } = await client
      .from('agent_runs')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
        error: { reason: 'dismissed_by_user' },
      })
      .eq('id', parsed.data.runId)
      .eq('workspace_id', workspaceId)
      .eq('status', 'waiting_approval');

    if (runError) {
      // Non-fatal: signal is dismissed; run cancellation failure leaves run in waiting_approval
      console.error(
        '[dismissIntegritySignal] failed to cancel agent_run:',
        runError.message,
      );
    }
  }

  revalidateTag(`agents:${workspaceId}`);
  return { success: true, data: { signalId: parsed.data.signalId } };
}

export interface IntegritySignalRow {
  id: string;
  sweepDate: string;
  anomalyType: string;
  affectedEntryIds: string[];
  payload: Record<string, unknown>;
  resolvedAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
}

// P3: use authenticated user client for reads — goes through RLS SELECT policy
// P9: return ActionResult instead of throwing raw Supabase errors
export async function getPendingIntegritySignals(): Promise<
  ActionResult<IntegritySignalRow[]>
> {
  const { workspaceId, userClient } = await getTenantContext();

  const { data, error } = await userClient
    .from('time_integrity_signals')
    .select(
      'id, sweep_date, anomaly_type, affected_entry_ids, payload, resolved_at, dismissed_at, created_at',
    )
    .eq('workspace_id', workspaceId)
    .is('dismissed_at', null)
    .is('resolved_at', null)
    .order('sweep_date', { ascending: false })
    .limit(50);

  if (error) {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', error.message, 'system'),
    };
  }

  return {
    success: true,
    data: (data ?? []).map((r) => ({
      id: r.id as string,
      sweepDate: r.sweep_date as string,
      anomalyType: r.anomaly_type as string,
      affectedEntryIds: (r.affected_entry_ids as string[]) ?? [],
      payload: (r.payload as Record<string, unknown>) ?? {},
      resolvedAt: (r.resolved_at as string | null) ?? null,
      dismissedAt: (r.dismissed_at as string | null) ?? null,
      createdAt: r.created_at as string,
    })),
  };
}
