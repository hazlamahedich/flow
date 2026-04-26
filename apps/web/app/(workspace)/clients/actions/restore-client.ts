'use server';

import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, createFlowError, cacheTag, restoreClient } from '@flow/db';
import { archiveClientSchema } from '@flow/types';
import type { ActionResult, Client } from '@flow/types';

export async function restoreWorkspaceClient(
  input: unknown,
): Promise<ActionResult<Client>> {
  const parsed = archiveClientSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(
        400,
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Validation failed',
        'validation',
      ),
    };
  }

  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return {
      success: false,
      error: createFlowError(403, 'INSUFFICIENT_ROLE', 'Only owners and admins can restore clients.', 'auth'),
    };
  }

  try {
    const client = await restoreClient(supabase, {
      clientId: parsed.data.clientId,
      workspaceId: ctx.workspaceId,
    });

    if (!client) {
      return { success: false, error: createFlowError(404, 'CLIENT_NOT_FOUND', 'Client not found or already active.', 'validation') };
    }

    revalidateTag(cacheTag('workspace_client', ctx.workspaceId));
    return { success: true, data: client };
  } catch {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to restore client.', 'system'),
    };
  }
}
