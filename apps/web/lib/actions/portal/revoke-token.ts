/**
 * Workspace-side Server Action: revoke a client portal token.
 *
 * Story 9.1a — AC2, FR8.
 */
'use server';

import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, createFlowError, cacheTag } from '@flow/db';
import type { ActionResult, FlowError } from '@flow/types';
import { revokePortalTokenSchema } from './schemas';
import { failure } from './helpers';

export async function revokePortalTokenAction(
  input: unknown,
): Promise<ActionResult<{ tokenId: string }>> {
  const parsed = revokePortalTokenSchema.safeParse(input);
  if (!parsed.success) {
    return failure(
      createFlowError(
        400,
        'VALIDATION_ERROR',
        parsed.error.message,
        'validation',
        {
          issues: parsed.error.issues,
        },
      ),
    );
  }

  const supabase = await getServerSupabase();

  let ctx;
  try {
    ctx = await requireTenantContext(supabase);
  } catch (err) {
    const error = err as FlowError;
    return failure(error);
  }

  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return failure(
      createFlowError(
        403,
        'INSUFFICIENT_ROLE',
        'Only owners and admins can revoke portal tokens.',
        'auth',
      ),
    );
  }

  const { tokenId } = parsed.data;

  const { data, error } = await supabase
    .from('portal_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', tokenId)
    .eq('workspace_id', ctx.workspaceId)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle();

  if (error || !data) {
    return failure(
      createFlowError(
        404,
        'NOT_FOUND',
        'Token not found or already revoked.',
        'validation',
      ),
    );
  }

  revalidateTag(cacheTag('portal_token', ctx.workspaceId));

  return { success: true, data: { tokenId: (data as { id: string }).id } };
}
