'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, createFlowError, getClientById, getMembersForClient } from '@flow/db';
import { z } from 'zod';
import type { ActionResult } from '@flow/types';
import type { Client } from '@flow/types';

interface ClientDetail extends Client {
  assignedMembers: Array<{
    id: string;
    userId: string;
    grantedBy: string;
    grantedAt: string | null;
  }>;
}

const getClientDetailSchema = z.object({ clientId: z.string().uuid() });

export async function getClientDetail(
  input: unknown,
): Promise<ActionResult<ClientDetail>> {
  const parsed = getClientDetailSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', 'Invalid client ID.', 'validation'),
    };
  }

  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  const client = await getClientById(supabase, {
    clientId: parsed.data.clientId,
    workspaceId: ctx.workspaceId,
  });

  if (!client) {
    return {
      success: false,
      error: createFlowError(404, 'CLIENT_NOT_FOUND', 'Client not found.', 'validation'),
    };
  }

  const members = await getMembersForClient(supabase, {
    clientId: parsed.data.clientId,
    workspaceId: ctx.workspaceId,
  });

  return {
    success: true,
    data: {
      ...client,
      assignedMembers: members.filter((m) => m.revokedAt === null),
    },
  };
}
