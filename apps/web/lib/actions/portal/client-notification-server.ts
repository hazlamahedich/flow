/**
 * Client notification Server Action (workspace caller).
 *
 * Entry point for Epic 7/8 triggers to send client notifications.
 * Verifies requireTenantContext and workspace membership before sending.
 *
 * Story 9.2 — AC5 (FR82).
 */
'use server';

import { z } from 'zod';
import { requireTenantContext, createFlowError } from '@flow/db';
import type { ActionResult } from '@flow/types';
import { sendNotificationInternal } from './client-notification';
const serverNotificationInputSchema = z.object({
  type: z.enum(['invoice_created', 'payment_confirmed', 'report_shared']),
  clientId: z.string().uuid(),
  payload: z.record(z.unknown()),
});

export async function sendClientNotificationServerAction(
  input: unknown,
): Promise<ActionResult<{ messageId?: string }>> {
  const parsed = serverNotificationInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', parsed.error.message, 'validation'),
    };
  }

  const supabase = await (await import('@/lib/supabase-server')).getServerSupabase();
  let ctx;
  try {
    ctx = await requireTenantContext(supabase);
  } catch {
    return {
      success: false,
      error: createFlowError(401, 'AUTH_REQUIRED', 'Authentication required', 'auth'),
    };
  }

  const { data: clientRow } = await supabase
    .from('clients')
    .select('workspace_id')
    .eq('id', parsed.data.clientId)
    .maybeSingle();

  const wsId = (clientRow as Record<string, unknown> | null)?.workspace_id;
  if (!wsId || wsId !== ctx.workspaceId) {
    return {
      success: false,
      error: createFlowError(403, 'FORBIDDEN', 'Client does not belong to this workspace.', 'auth'),
    };
  }

  // TODO(9-3a): Wire payment_confirmed trigger after Stripe webhook processing.
  return sendNotificationInternal(
    parsed.data.clientId,
    ctx.workspaceId,
    parsed.data.type,
    parsed.data.payload,
  );
}
