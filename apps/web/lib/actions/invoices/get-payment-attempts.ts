'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, createFlowError, getPaymentAttemptsByInvoice } from '@flow/db';
import type { ActionResult } from '@flow/types';
import type { PaymentAttempt } from '@flow/db';

export async function getPaymentAttemptsAction(
  invoiceId: string,
): Promise<ActionResult<PaymentAttempt[]>> {
  const supabase = await getServerSupabase();

  let ctx;
  try {
    ctx = await requireTenantContext(supabase);
  } catch {
    return {
      success: false,
      error: createFlowError(401, 'AUTH_REQUIRED', 'Authentication required', 'auth'),
    };
  }

  try {
    const attempts = await getPaymentAttemptsByInvoice(supabase, invoiceId, ctx.workspaceId);
    return { success: true, data: attempts };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch payment attempts';
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', message, 'system'),
    };
  }
}
