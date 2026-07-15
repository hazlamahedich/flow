/**
 * Server Action: persist workspace portal branding config.
 *
 * Story 9.1b — T4.2, AC3.
 *
 * Owner/Admin only → INSUFFICIENT_ROLE otherwise. Parses via brandingConfigSchema,
 * persists to workspaces.portal_branding, revalidateTag('portal-branding').
 *
 * This is the backend API for Epic 10's settings UI; no settings page is built
 * in 9-1b.
 */
'use server';

import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, createFlowError } from '@flow/db';
import type { ActionResult, FlowError } from '@flow/types';
import { brandingConfigSchema } from '@/lib/portal-branding/schema';
import type { PortalBrandingConfig } from '@/lib/portal-branding/resolve';

function failure(error: FlowError): { success: false; error: FlowError } {
  return { success: false, error };
}

/**
 * Save the workspace's portal branding configuration.
 * Validates input, persists to DB, and invalidates the portal-branding cache.
 */
export async function savePortalBrandingAction(
  input: unknown,
): Promise<ActionResult<{ workspaceId: string }>> {
  const parsed = brandingConfigSchema.safeParse(input);
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
    return failure(err as FlowError);
  }

  if (ctx.role !== 'owner' && ctx.role !== 'admin') {
    return failure(
      createFlowError(
        403,
        'INSUFFICIENT_ROLE',
        'Only owners and admins can configure portal branding.',
        'auth',
      ),
    );
  }

  const config: PortalBrandingConfig = {
    preset: parsed.data.preset,
    ...(parsed.data.visual && { visual: parsed.data.visual }),
    ...(parsed.data.content && { content: parsed.data.content }),
  };

  const { error: updateError } = await supabase
    .from('workspaces')
    .update({ portal_branding: config })
    .eq('id', ctx.workspaceId);

  if (updateError) {
    return failure(
      createFlowError(
        500,
        'INTERNAL_ERROR',
        'Failed to save branding config.',
        'system',
        { cause: updateError.message },
      ),
    );
  }

  revalidateTag('portal-branding');

  return { success: true, data: { workspaceId: ctx.workspaceId } };
}
