import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, getActiveRetainerForClient, getRetainerUtilization } from '@flow/db';
import type { Retainer } from '@flow/types';

export interface RetainerDetail {
  retainer: Retainer | null;
  utilization: {
    totalMinutes: number;
    allocatedMinutes: number;
    utilizationPercent: number;
    billingPeriodStart: string;
    billingPeriodEnd: string | null;
  } | null;
}

export async function getRetainerDetail(
  clientId: string,
): Promise<RetainerDetail> {
  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  const retainer = await getActiveRetainerForClient(supabase, {
    clientId,
    workspaceId: ctx.workspaceId,
  });

  if (!retainer) {
    return { retainer: null, utilization: null };
  }

  const utilization = await getRetainerUtilization(supabase, {
    retainerId: retainer.id,
    workspaceId: ctx.workspaceId,
  });

  return { retainer, utilization };
}
