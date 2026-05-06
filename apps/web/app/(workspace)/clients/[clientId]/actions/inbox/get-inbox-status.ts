'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, createFlowError, getClientInboxes } from '@flow/db';
import { z } from 'zod';
import type { ActionResult, ClientInbox } from '@flow/types';

const getStatusSchema = z.object({ clientId: z.string().uuid() });

export async function getInboxStatus(
  input: unknown,
): Promise<ActionResult<ClientInbox[]>> {
  const parsed = getStatusSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', 'Invalid client ID.', 'validation'),
    };
  }

  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  const inboxes = await getClientInboxes(supabase, ctx.workspaceId, parsed.data.clientId);
  return { success: true, data: inboxes };
}
