'use server';

import { getUnacknowledgedRegressions } from '@flow/db';
import type { ActionResult } from '@flow/types';
import { AGENT_LABELS } from '../constants/trust-copy';

export interface RehydrationEntry {
  id: string;
  transitionId: string;
  agentId: string;
  agentLabel: string;
  triggerReason: string;
  fromLevel: string;
  toLevel: string;
  matrixEntryId: string;
  expectedVersion: number;
  isAutoTriggered: boolean;
}

export async function fetchUnacknowledgedRegressions(): Promise<
  ActionResult<RehydrationEntry[]>
> {
  try {
    const { createServerClient, requireTenantContext } = await import('@flow/db');
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();
    const client = createServerClient({
      getAll: () =>
        cookieStore.getAll().map((c: { name: string; value: string }) => ({
          name: c.name,
          value: c.value,
        })),
      set: () => {},
    });
    const ctx = await requireTenantContext(client);
    const regressions = await getUnacknowledgedRegressions(ctx.workspaceId);

    const entries: RehydrationEntry[] = regressions.map((r) => {
      const matrixData = r.trust_matrix?.[0];
      const agentId = matrixData?.agent_id ?? '';
      return {
        id: r.id,
        transitionId: r.id,
        agentId,
        agentLabel: AGENT_LABELS[agentId] ?? agentId,
        triggerReason: r.trigger_reason,
        fromLevel: r.from_level,
        toLevel: r.to_level,
        matrixEntryId: r.matrix_entry_id,
        expectedVersion: matrixData?.version ?? 1,
        isAutoTriggered: r.trigger_type === 'hard_violation',
      };
    });

    return { success: true, data: entries };
  } catch {
    return { success: true, data: [] };
  }
}
