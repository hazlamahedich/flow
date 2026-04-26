'use server';

import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, createFlowError, cacheTag, updateClient } from '@flow/db';
import { updateClientSchema } from '@flow/types';
import type { ActionResult, Client } from '@flow/types';

export async function updateWorkspaceClient(
  input: unknown,
): Promise<ActionResult<Client>> {
  const parsed = updateClientSchema.safeParse(input);
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

  if (ctx.role === 'member') {
    return {
      success: false,
      error: createFlowError(403, 'INSUFFICIENT_ROLE', 'Members cannot update clients.', 'auth'),
    };
  }

  const { getClientById } = await import('@flow/db');
  const existing = await getClientById(supabase, { clientId: parsed.data.clientId, workspaceId: ctx.workspaceId });
  if (!existing) {
    return { success: false, error: createFlowError(404, 'CLIENT_NOT_FOUND', 'Client not found.', 'validation') };
  }
  if (existing.status === 'archived') {
    return { success: false, error: createFlowError(409, 'CLIENT_ARCHIVED', 'Cannot edit archived client. Restore first.', 'validation') };
  }

  try {
    const { clientId, ...updates } = parsed.data;
    const data: Record<string, unknown> = {};
    if (updates.name !== undefined) data.name = updates.name;
    if (updates.email !== undefined) data.email = updates.email ?? null;
    if (updates.phone !== undefined) data.phone = updates.phone ?? null;
    if (updates.companyName !== undefined) data.company_name = updates.companyName ?? null;
    if (updates.address !== undefined) data.address = updates.address ?? null;
    if (updates.notes !== undefined) data.notes = updates.notes ?? null;
    if (updates.billingEmail !== undefined) data.billing_email = updates.billingEmail ?? null;
    if (updates.hourlyRateCents !== undefined) data.hourly_rate_cents = updates.hourlyRateCents ?? null;

    const client = await updateClient(supabase, {
      clientId,
      workspaceId: ctx.workspaceId,
      data,
    });

    revalidateTag(cacheTag('workspace_client', ctx.workspaceId));
    return { success: true, data: client };
  } catch {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to update client.', 'system'),
    };
  }
}
