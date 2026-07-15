'use server';

import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';
import {
  requireTenantContext,
  createFlowError,
  cacheTag,
  insertClient,
  checkDuplicateEmail,
} from '@flow/db';
import { createClientSchema } from '@flow/types';
import type { ActionResult, Client } from '@flow/types';
import { enforceTierLimit } from '@/lib/actions/billing/enforce-tier-limit';

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
      error: createFlowError(
        403,
        'INSUFFICIENT_ROLE',
        'Members cannot create clients.',
        'auth',
      ),
    };
  }

  // Tier limit enforcement (Story 9.4 AC3 — replaces the legacy inline
  // app_config + settings.tier + -1 sentinel check). enforceTierLimit reads
  // subscription_tier via RLS, normalizes null → unlimited (Agency), and
  // delegates the pure decision to checkTierLimit. Existing data is NEVER
  // blocked — only new resource creation (FR56).
  const tierCheck = await enforceTierLimit({
    workspaceId: ctx.workspaceId,
    resource: 'clients',
  });
  if (!tierCheck.allowed) {
    const limitText = tierCheck.limit != null ? `(${tierCheck.limit})` : '';
    return {
      success: false,
      error: createFlowError(
        403,
        'TIER_LIMIT_EXCEEDED',
        `You've reached the client limit ${limitText} for your plan. Upgrade to add more.`,
        'validation',
        {
          resource: 'clients',
          current: tierCheck.current,
          limit: tierCheck.limit,
          tier: tierCheck.tier,
          reason: tierCheck.reason,
        },
      ),
    };
  }

  if (parsed.data.email && parsed.data.email.trim() !== '') {
    const existing = await checkDuplicateEmail(
      supabase,
      ctx.workspaceId,
      parsed.data.email.trim(),
    );
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
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        'Failed to create client.',
        'system',
      ),
    };
  }
}
