import type { SupabaseClient } from '@supabase/supabase-js';
import type { FlowErrorBase } from '@flow/types';

export interface TenantContext {
  workspaceId: string;
  userId: string;
  role: string;
}

export function createFlowError(
  status: number,
  code: FlowErrorBase['code'],
  message: string,
  category: FlowErrorBase['category'],
  details?: Record<string, unknown>,
): FlowErrorBase {
  const result: FlowErrorBase = { status, code, message, category };
  if (details !== undefined) {
    result.details = details;
  }
  return result;
}

export async function requireTenantContext(
  client: SupabaseClient,
): Promise<TenantContext> {
  const { data, error } = await client.auth.getUser();

  if (error || !data.user) {
    throw createFlowError(
      401,
      'AUTH_REQUIRED',
      'Authentication required',
      'auth',
    );
  }

  const workspaceId = data.user.app_metadata?.workspace_id as string | undefined;
  if (!workspaceId) {
    throw createFlowError(
      403,
      'TENANT_CONTEXT_MISSING',
      'No active workspace. Select a workspace to continue.',
      'auth',
    );
  }

  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(workspaceId)) {
    throw createFlowError(
      403,
      'TENANT_CONTEXT_MISSING',
      'Invalid workspace context.',
      'auth',
      { workspaceId },
    );
  }

  const role = data.user.app_metadata?.role as string | undefined;
  if (!role) {
    throw createFlowError(
      403,
      'TENANT_CONTEXT_MISSING',
      'Missing role in workspace context.',
      'auth',
    );
  }

  return {
    workspaceId,
    userId: data.user.id,
    role,
  };
}

/**
 * Sets the PG session variable `toast.workspace_id` via `set_config()`.
 *
 * This is NOT used for RLS tenant isolation — all RLS policies read
 * `workspace_id` from JWT claims (`auth.jwt()->>'workspace_id'`).
 * Use this only for non-RLS server-side code that needs the current
 * tenant ID in a PG session context (e.g., audit triggers that run
 * as SECURITY DEFINER outside the authenticated user's JWT scope).
 */
export async function setTenantContext(
  client: SupabaseClient,
  workspaceId: string,
): Promise<void> {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(workspaceId)) {
    throw createFlowError(
      400,
      'VALIDATION_ERROR',
      'Invalid workspace ID format.',
      'validation',
      { workspaceId },
    );
  }

  await client.rpc('set_config', {
    name: 'toast.workspace_id',
    value: workspaceId,
  });
}
