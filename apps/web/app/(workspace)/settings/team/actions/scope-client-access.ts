'use server';

import { scopeClientAccessSchema } from '@flow/types';
import type { ActionResult } from '@flow/types';
import { createFlowError, requireTenantContext, cacheTag } from '@flow/db';
import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';
import { logWorkspaceEvent } from '@/lib/workspace-audit';

export async function grantClientAccess(
  input: unknown,
): Promise<ActionResult<void>> {
  const parsed = scopeClientAccessSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(
        400,
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Invalid input',
        'validation',
      ),
    };
  }

  const { userId, clientId } = parsed.data;
  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return {
      success: false,
      error: createFlowError(
        403,
        'INSUFFICIENT_ROLE',
        "You don't have permission to perform this action.",
        'auth',
      ),
    };
  }

  const { data: targetMember } = await supabase
    .from('workspace_members')
    .select('role, status')
    .eq('user_id', userId)
    .eq('workspace_id', ctx.workspaceId)
    .eq('status', 'active')
    .single();

  if (!targetMember) {
    return {
      success: false,
      error: createFlowError(
        404,
        'NOT_FOUND',
        'Active membership not found.',
        'validation',
      ),
    };
  }

  if (targetMember.role !== 'member') {
    return {
      success: false,
      error: createFlowError(
        400,
        'VALIDATION_ERROR',
        'Client scoping is only available for Members.',
        'validation',
      ),
    };
  }

  const { data: clientExists } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();

  if (!clientExists) {
    return {
      success: false,
      error: createFlowError(
        400,
        'VALIDATION_ERROR',
        'Client does not belong to this workspace.',
        'validation',
      ),
    };
  }

  const { data: existingRevoked } = await supabase
    .from('member_client_access')
    .select('id')
    .eq('user_id', userId)
    .eq('client_id', clientId)
    .eq('workspace_id', ctx.workspaceId)
    .not('revoked_at', 'is', null)
    .maybeSingle();

  if (existingRevoked) {
    const { error: reactivateError } = await supabase
      .from('member_client_access')
      .update({ revoked_at: null, granted_by: ctx.userId })
      .eq('id', existingRevoked.id);

    if (reactivateError) {
      return {
        success: false,
        error: createFlowError(
          500,
          'INTERNAL_ERROR',
          "Couldn't update client access. Please try again.",
          'system',
        ),
      };
    }
  } else {
    const { error } = await supabase
      .from('member_client_access')
      .insert({
        workspace_id: ctx.workspaceId,
        user_id: userId,
        client_id: clientId,
        granted_by: ctx.userId,
      });

    if (error) {
      if (error.code === '23505') {
        return {
          success: false,
          error: createFlowError(
            409,
            'CONFLICT',
            'Client access already granted.',
            'validation',
          ),
        };
      }
      return {
        success: false,
        error: createFlowError(
          500,
          'INTERNAL_ERROR',
          "Couldn't update client access. Please try again.",
          'system',
        ),
      };
    }
  }

  revalidateTag(cacheTag('workspace_client', ctx.workspaceId));

  try {
    await logWorkspaceEvent({
      type: 'client_access_granted',
      workspaceId: ctx.workspaceId,
      userId,
      clientId,
      grantedBy: ctx.userId,
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Audit logging best-effort — do not fail the action
  }

  return { success: true, data: undefined };
}

export async function revokeClientAccess(
  input: unknown,
): Promise<ActionResult<void>> {
  const parsed = scopeClientAccessSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(
        400,
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'Invalid input',
        'validation',
      ),
    };
  }

  const { userId, clientId } = parsed.data;
  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return {
      success: false,
      error: createFlowError(
        403,
        'INSUFFICIENT_ROLE',
        "You don't have permission to perform this action.",
        'auth',
      ),
    };
  }

  const { data: targetMember } = await supabase
    .from('workspace_members')
    .select('role, status')
    .eq('user_id', userId)
    .eq('workspace_id', ctx.workspaceId)
    .eq('status', 'active')
    .maybeSingle();

  if (!targetMember || targetMember.role !== 'member') {
    return {
      success: false,
      error: createFlowError(
        404,
        'NOT_FOUND',
        'Active member not found.',
        'validation',
      ),
    };
  }

  const { data: existing } = await supabase
    .from('member_client_access')
    .select('id')
    .eq('user_id', userId)
    .eq('client_id', clientId)
    .eq('workspace_id', ctx.workspaceId)
    .is('revoked_at', null)
    .maybeSingle();

  if (!existing) {
    return {
      success: false,
      error: createFlowError(
        404,
        'NOT_FOUND',
        'Active client access not found.',
        'validation',
      ),
    };
  }

  const { error } = await supabase
    .from('member_client_access')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', existing.id);

  if (error) {
    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        "Couldn't update client access. Please try again.",
        'system',
      ),
    };
  }

  revalidateTag(cacheTag('workspace_client', ctx.workspaceId));

  try {
    await logWorkspaceEvent({
      type: 'client_access_revoked',
      workspaceId: ctx.workspaceId,
      userId,
      clientId,
      revokedBy: ctx.userId,
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Audit logging best-effort — do not fail the action
  }

  return { success: true, data: undefined };
}
