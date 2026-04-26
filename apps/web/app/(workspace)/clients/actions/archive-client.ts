'use server';

import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';
import {
  requireTenantContext,
  createFlowError,
  cacheTag,
  archiveClient,
  hasActiveAgentRuns,
} from '@flow/db';
import { archiveClientSchema } from '@flow/types';
import type { ActionResult, Client } from '@flow/types';

export async function archiveWorkspaceClient(
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
      error: createFlowError(403, 'INSUFFICIENT_ROLE', 'Only owners and admins can archive clients.', 'auth'),
    };
  }

  const hasRuns = await hasActiveAgentRuns(supabase, parsed.data.clientId);
  if (hasRuns) {
    return {
      success: false,
      error: createFlowError(
        409,
        'CLIENT_ACTIVE_RUNS',
        'Cannot archive client with active agent runs. Wait for them to complete or cancel them first.',
        'validation',
      ),
    };
  }

  try {
    const client = await archiveClient(supabase, {
      clientId: parsed.data.clientId,
      workspaceId: ctx.workspaceId,
    });

    if (!client) {
      return { success: false, error: createFlowError(404, 'CLIENT_NOT_FOUND', 'Client not found or already archived.', 'validation') };
    }

    revalidateTag(cacheTag('workspace_client', ctx.workspaceId));
    return { success: true, data: client };
  } catch {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to archive client.', 'system'),
    };
  }
}
