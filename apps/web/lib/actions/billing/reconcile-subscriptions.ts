'use server';

import { runReconciliation } from '@flow/agents';
import type { ActionResult, ReconciliationReport } from '@flow/types';

export async function reconcileSubscriptionsAction(
  _input?: unknown
): Promise<ActionResult<ReconciliationReport>> {
  const report = await runReconciliation();
  return { success: true, data: report };
}
