'use server';

import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';
import {
  requireTenantContext,
  createFlowError,
  cacheTag,
  insertClient,
  countActiveClients,
  checkDuplicateEmail,
} from '@flow/db';
import {
  createClientSchema,
} from '@flow/types';
import type { ActionResult, Client } from '@flow/types';

export async function createWorkspaceClient(
  input: unknown,
): Promise<ActionResult<Client>> {
  const parsed = createClientSchema.safeParse(input);
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
      error: createFlowError(403, 'INSUFFICIENT_ROLE', 'Members cannot create clients.', 'auth'),
    };
  }

  const { data: configRow } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'tier_limits')
    .single();

  if (configRow?.value) {
    const tierLimits = configRow.value as Record<string, { maxClients?: number }>;
    const { data: wsRow } = await supabase
      .from('workspaces')
      .select('settings')
      .eq('id', ctx.workspaceId)
      .single();
    const workspaceTier = (wsRow?.settings as Record<string, unknown> | null)?.tier as string ?? 'free';
    const limit = tierLimits[workspaceTier]?.maxClients ?? 5;

    if (limit !== -1) {
      const currentCount = await countActiveClients(supabase, ctx.workspaceId);
      if (currentCount >= limit) {
        return {
          success: false,
          error: createFlowError(
            403,
            'CLIENT_LIMIT_REACHED',
            `You've reached the client limit (${limit}) for your plan. Upgrade to add more.`,
            'validation',
            { currentCount, limit, tier: workspaceTier },
          ),
        };
      }
    }
  }

  if (parsed.data.email && parsed.data.email.trim() !== '') {
    const existing = await checkDuplicateEmail(supabase, ctx.workspaceId, parsed.data.email.trim());
    if (existing) {
      return {
        success: false,
        error: createFlowError(
          409,
          'CLIENT_DUPLICATE_EMAIL',
          `A client with this email already exists (${existing.name}, ${existing.status}).`,
          'validation',
          { existingClientId: existing.id, existingName: existing.name },
        ),
      };
    }
  }

  try {
    const client = await insertClient(supabase, {
      workspaceId: ctx.workspaceId,
      data: {
        name: parsed.data.name,
        email: parsed.data.email ?? null,
        phone: parsed.data.phone ?? null,
        companyName: parsed.data.companyName ?? null,
        address: parsed.data.address ?? null,
        notes: parsed.data.notes ?? null,
        billingEmail: parsed.data.billingEmail ?? null,
        hourlyRateCents: parsed.data.hourlyRateCents ?? null,
      },
    });

    revalidateTag(cacheTag('workspace_client', ctx.workspaceId));
    return { success: true, data: client };
  } catch {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to create client.', 'system'),
    };
  }
}
