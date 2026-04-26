'use server';

import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';
import {
  requireTenantContext,
  createFlowError,
  cacheTag,
  archiveClient,
  restoreClient,
  hasActiveAgentRuns,
} from '@flow/db';
import { z } from 'zod';
import type { ActionResult, Client } from '@flow/types';

const toggleArchiveSchema = z.object({
  clientId: z.string().uuid(),
  action: z.enum(['archive', 'restore']),
});

export async function toggleArchive(
  input: unknown,
): Promise<ActionResult<Client>> {
  const parsed = toggleArchiveSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', 'Invalid input.', 'validation'),
    };
  }

  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return {
      success: false,
      error: createFlowError(403, 'INSUFFICIENT_ROLE', 'Only owners and admins can archive/restore.', 'auth'),
    };
  }

  try {
    if (parsed.data.action === 'archive') {
      const hasRuns = await hasActiveAgentRuns(supabase, parsed.data.clientId);
      if (hasRuns) {
        return {
          success: false,
          error: createFlowError(409, 'CLIENT_ACTIVE_RUNS', 'Cannot archive: active agent runs.', 'validation'),
        };
      }

      const client = await archiveClient(supabase, {
        clientId: parsed.data.clientId,
        workspaceId: ctx.workspaceId,
      });

      if (!client) {
        return { success: false, error: createFlowError(404, 'CLIENT_NOT_FOUND', 'Client not found or already archived.', 'validation') };
      }

      revalidateTag(cacheTag('workspace_client', ctx.workspaceId));
      return { success: true, data: client };
    }

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
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to toggle archive.', 'system'),
    };
  }
}
