'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, createFlowError, getInvoiceWithBalance } from '@flow/db';
import type { ActionResult } from '@flow/types';

export async function getInvoiceDetailAction(
  invoiceId: string,
): Promise<ActionResult<Awaited<ReturnType<typeof getInvoiceWithBalance>>>> {
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

  const detail = await getInvoiceWithBalance(supabase, invoiceId, ctx.workspaceId);

  if (!detail) {
    return {
      success: false,
      error: createFlowError(404, 'NOT_FOUND', 'Invoice not found.', 'validation'),
    };
  }

  return { success: true, data: detail };
}
