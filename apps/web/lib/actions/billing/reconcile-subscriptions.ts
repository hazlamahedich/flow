'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { runReconciliation } from '@flow/agents';
import type { ActionResult, ReconciliationReport } from '@flow/types';
import { requireOwner, toFailure, withTenantContext } from './_helpers';

export async function reconcileSubscriptionsAction(
  _input?: unknown,
): Promise<ActionResult<ReconciliationReport>> {
  const supabase = await getServerSupabase();
  return withTenantContext<ReconciliationReport>(supabase, async (ctx) => {
    const forbidden = requireOwner(ctx);
    if (forbidden) return toFailure(forbidden);

    const report = await runReconciliation();
    return { success: true, data: report };
  });
}
