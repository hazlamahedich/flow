/**
 * Client notification Server Action (portal caller).
 *
 * Sends transactional email to the client for invoice_created, payment_confirmed,
 * and report_shared events. Email comes from the clients row (server-side).
 * Never throws — failures are logged and returned via error.code.
 *
 * Story 9.2 — AC5 (FR82).
 */
'use server';

import { z } from 'zod';
import { getServerSupabase } from '@/lib/supabase-server';
import { createFlowError } from '@flow/db';
import type { ActionResult } from '@flow/types';
import { getTransactionalEmailProvider } from '@flow/agents/providers';
import { getAppUrl } from './helpers';
import type { PortalContext } from './helpers';
import {
  buildClientNotificationEmail,
  type ClientNotificationType,
  type ClientNotificationPayload,
} from './client-notification-templates';

const clientNotificationPayloadSchema = z.object({
  invoiceId: z.string().uuid().optional(),
  reportId: z.string().uuid().optional(),
  amountCents: z.number().int().min(0).optional(),
  currency: z.string().min(3).max(3).optional(),
  invoiceNumber: z.string().optional(),
}).strict();

const notificationInputSchema = z.object({
  type: z.enum(['invoice_created', 'payment_confirmed', 'report_shared']),
  clientId: z.string().uuid(),
  payload: clientNotificationPayloadSchema,
});

export async function sendClientNotificationAction(
  portalCtx: PortalContext,
  input: unknown,
): Promise<ActionResult<{ messageId?: string }>> {
  const parsed = notificationInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', parsed.error.message, 'validation'),
    };
  }

  if (portalCtx.clientId !== parsed.data.clientId) {
    return {
      success: false,
      error: createFlowError(403, 'FORBIDDEN', 'Cannot send notifications for another client.', 'auth'),
    };
  }

  return sendNotificationInternal(
    parsed.data.clientId,
    portalCtx.workspaceId,
    parsed.data.type,
    parsed.data.payload,
  );
}

export async function sendNotificationInternal(
  clientId: string,
  workspaceId: string,
  type: ClientNotificationType,
  payload: ClientNotificationPayload,
): Promise<ActionResult<{ messageId?: string }>> {
  const supabase = await getServerSupabase();

  const { data: clientRow } = await supabase
    .from('clients')
    .select('email, name, workspace_id')
    .eq('id', clientId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  const clientData = (clientRow ?? {}) as Record<string, unknown>;
  const clientEmail = (clientData.email as string) ?? '';
  const clientName = (clientData.name as string) ?? '';
  const workspaceName = 'Flow OS';

  if ((clientData.workspace_id as string | undefined) !== workspaceId || !clientEmail) {
    const mismatch = (clientData.workspace_id as string | undefined) !== workspaceId;
    await logNotification(
      supabase,
      clientId,
      workspaceId,
      type,
      payload,
      null,
      'skipped',
      mismatch ? 'CLIENT_WORKSPACE_MISMATCH' : 'CLIENT_NO_EMAIL',
    );
    return {
      success: false,
      error: createFlowError(
        mismatch ? 403 : 400,
        mismatch ? 'FORBIDDEN' : 'CLIENT_NO_EMAIL',
        mismatch ? 'Client does not belong to this workspace.' : 'Client has no email address.',
        mismatch ? 'auth' : 'validation',
      ),
    };
  }

  const emailPayload = buildClientNotificationEmail({
    to: clientEmail,
    clientName,
    workspaceName,
    type,
    payload,
    portalUrl: `${getAppUrl()}/portal`,
  });

  const provider = getTransactionalEmailProvider('resend');
  try {
    const result = await provider.send(emailPayload);
    await logNotification(supabase, clientId, workspaceId, type, payload, result.messageId, 'sent', null);
    return { success: true, data: { messageId: result.messageId } };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown email error';
    await logNotification(supabase, clientId, workspaceId, type, payload, null, 'failed', errMsg);
    return {
      success: false,
      error: createFlowError(500, 'EMAIL_ERROR', 'Failed to send notification email.', 'system', { error: errMsg }),
    };
  }
}

async function logNotification(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  clientId: string,
  workspaceId: string,
  type: ClientNotificationType,
  payload: ClientNotificationPayload,
  messageId: string | null,
  status: string,
  error: string | null,
): Promise<void> {
  await supabase.rpc('log_client_notification', {
    p_type: type,
    p_client_id: clientId,
    p_workspace_id: workspaceId,
    p_payload: payload as Record<string, unknown>,
    p_provider_message_id: messageId,
    p_status: status,
    p_error: error,
  });
}
