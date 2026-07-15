'use server';

import { z } from 'zod';
import { getServerSupabase } from '@/lib/supabase-server';
import {
  requireTenantContext,
  createFlowError,
  dismissWednesdayAffirmation as dbDismiss,
} from '@flow/db';
import type { ActionResult } from '@flow/types';

const dismissSchema = z.object({
  affirmationId: z.string().uuid(),
});

export async function dismissWednesdayAffirmationAction(
  input: unknown,
): Promise<ActionResult<{ dismissed: boolean }>> {
  const parsed = dismissSchema.safeParse(input);
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
  let ctx;
  try {
    ctx = await requireTenantContext(supabase);
  } catch {
    return {
      success: false,
      error: createFlowError(
        401,
        'AUTH_REQUIRED',
        'Authentication required',
        'auth',
      ),
    };
  }

  if (ctx.role !== 'owner') {
    return {
      success: false,
      error: createFlowError(
        403,
        'FORBIDDEN',
        'Only owners can dismiss Wednesday affirmations.',
        'auth',
      ),
    };
  }

  const ok = await dbDismiss(
    supabase,
    ctx.workspaceId,
    parsed.data.affirmationId,
  );
  if (!ok) {
    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        'Failed to dismiss affirmation.',
        'system',
      ),
    };
  }

  return { success: true, data: { dismissed: true } };
}
