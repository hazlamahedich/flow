'use server';

import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';
import {
  requireTenantContext,
  createFlowError,
  cacheTag,
  createRetainer,
} from '@flow/db';
import { createRetainerSchema } from '@flow/types';
import type { ActionResult, Retainer } from '@flow/types';

export async function createRetainerAction(
  input: unknown,
): Promise<ActionResult<Retainer>> {
  const parsed = createRetainerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', 'Invalid retainer data.', 'validation', {
        issues: parsed.error.issues,
      }),
    };
  }

  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return {
      success: false,
      error: createFlowError(403, 'INSUFFICIENT_ROLE', 'Only owners and admins can create retainers.', 'auth'),
    };
  }

  const { type, clientId, ...rest } = parsed.data;

  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('status')
    .eq('id', clientId)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();

  if (clientError || !client) {
    return { success: false, error: createFlowError(404, 'CLIENT_NOT_FOUND', 'Client not found.', 'validation') };
  }

  if (client.status === 'archived') {
    return { success: false, error: createFlowError(400, 'RETAINER_CLIENT_ARCHIVED', 'Cannot create retainer for archived client.', 'validation') };
  }

  try {
    const retainer = await createRetainer(supabase, {
      workspaceId: ctx.workspaceId,
      data: {
        clientId,
        type,
        ...('hourlyRateCents' in rest && rest.hourlyRateCents != null ? { hourlyRateCents: rest.hourlyRateCents } : {}),
        ...('monthlyFeeCents' in rest && rest.monthlyFeeCents != null ? { monthlyFeeCents: rest.monthlyFeeCents } : {}),
        ...('monthlyHoursThreshold' in rest && rest.monthlyHoursThreshold != null ? { monthlyHoursThreshold: rest.monthlyHoursThreshold } : {}),
        ...('packageHours' in rest && rest.packageHours != null ? { packageHours: rest.packageHours } : {}),
        ...('packageName' in rest && rest.packageName != null ? { packageName: rest.packageName } : {}),
        billingPeriodDays: rest.billingPeriodDays,
        startDate: rest.startDate,
        endDate: rest.endDate ?? null,
        notes: rest.notes || null,
      },
    });

    revalidateTag(cacheTag('retainer_agreement', ctx.workspaceId));
    revalidateTag(cacheTag('workspace_client', ctx.workspaceId));
    revalidateTag(cacheTag('dashboard', ctx.workspaceId));
    return { success: true, data: retainer };
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'retainerCode' in err && (err as { retainerCode?: string }).retainerCode === 'RETAINER_ACTIVE_EXISTS') {
      return {
        success: false,
        error: createFlowError(409, 'RETAINER_ACTIVE_EXISTS', 'This client already has an active retainer agreement.', 'validation'),
      };
    }
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to create retainer.', 'system'),
    };
  }
}
