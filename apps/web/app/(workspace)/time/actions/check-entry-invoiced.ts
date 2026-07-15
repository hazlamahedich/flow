'use server';

import { z } from 'zod';
import type { ActionResult } from '@flow/types';
import { getServerSupabase } from '@/lib/supabase-server';
import {
  requireTenantContext,
  createFlowError,
  getTimeEntryForUpdate,
  defaultInvoiceEditGuard,
} from '@flow/db';

const checkInvoicedSchema = z.object({
  entryId: z.string().uuid(),
});

export async function checkEntryInvoicedAction(
  input: unknown,
): Promise<ActionResult<{ invoiced: boolean }>> {
  const parsed = checkInvoicedSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(
        400,
        'VALIDATION_ERROR',
        parsed.error.message,
        'validation',
      ),
    };
  }

  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  const entry = await getTimeEntryForUpdate(supabase, {
    id: parsed.data.entryId,
    workspaceId: ctx.workspaceId,
  });

  if (!entry) {
    return {
      success: false,
      error: createFlowError(
        404,
        'NOT_FOUND',
        'Time entry not found',
        'validation',
      ),
    };
  }

  const invoiced = await defaultInvoiceEditGuard.isInvoiced(
    parsed.data.entryId,
  );
  return { success: true, data: { invoiced } };
}
