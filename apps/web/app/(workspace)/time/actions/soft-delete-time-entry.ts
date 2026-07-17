'use server';

import { z } from 'zod';
import type { ActionResult } from '@flow/types';
import { getServerSupabase } from '@/lib/supabase-server';
import {
  requireTenantContext,
  createFlowError,
  softDeleteTimeEntry,
} from '@flow/db';

const softDeleteSchema = z.object({
  id: z.string().uuid(),
});

export async function softDeleteTimeEntryAction(
  input: unknown,
): Promise<ActionResult<{ success: boolean }>> {
  const parsed = softDeleteSchema.safeParse(input);
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

  try {
    await softDeleteTimeEntry(supabase, {
      id: parsed.data.id,
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      role: ctx.role,
    });

    return { success: true, data: { success: true } };
  } catch {
    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        'Failed to delete time entry',
        'system',
      ),
    };
  }
}
