'use server';

import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';
import {
  requireTenantContext,
  createFlowError,
  cacheTag,
  invalidateAfterMutation,
} from '@flow/db';
import { resendInvoiceSchema } from '@flow/types';
import type { ActionResult } from '@flow/types';
import { getTransactionalEmailProvider } from '@flow/agents/providers';
import { formatCentsToDollar } from '@flow/shared';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildEmailPayload(args: {
  to: string;
  invoiceNumber: string;
  totalCents: number;
  currency: string;
  clientName: string;
  paymentUrl: string;
  workspaceName: string;
  metadata: Record<string, string>;
}) {
  const totalDollars = formatCentsToDollar(args.totalCents);
  return {
    to: args.to,
    subject: `Invoice ${args.invoiceNumber} from ${args.workspaceName}`,
    htmlBody: `<!DOCTYPE html>
<html><body>
  <p>Dear ${escapeHtml(args.clientName)},\u003c/p>
  <p>Here is your invoice \u003cstrong>${escapeHtml(args.invoiceNumber)}\u003c/strong> for ${args.currency.toUpperCase()} ${totalDollars}.\u003c/p>
  <p>\u003ca href="${encodeURI(args.paymentUrl)}" style="display:inline-block;padding:10px 16px;background:#0f172a;color:#fff;text-decoration:none;border-radius:4px;">Pay Invoice\u003c/a>\u003c/p>
  <p style="color:#666;font-size:12px;">If the button does not work, copy this link: ${encodeURI(args.paymentUrl)}\u003c/p>
</body></html>`,
    textBody: `Dear ${args.clientName},\n\nHere is your invoice ${args.invoiceNumber} for ${args.currency.toUpperCase()} ${totalDollars}.\n\nPay here: ${args.paymentUrl}\n\n- Flow OS`,
    metadata: args.metadata,
  };
}

export async function resendInvoiceAction(
  input: unknown,
): Promise<ActionResult<{ invoiceId: string; messageId: string }>> {
  const parsed = resendInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(
        400,
        'VALIDATION_ERROR',
        parsed.error.message,
        'validation',
      ),
    };
  }

  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  const { invoiceId } = parsed.data;

  const { data: invoice, error: fetchError } = await supabase
    .from('invoices')
    .select(
      'id, workspace_id, client_id, invoice_number, status, total_cents, currency, payment_url, clients(name, email), workspaces(name)',
    )
    .eq('id', invoiceId)
    .eq('workspace_id', ctx.workspaceId)
    .single();

  if (fetchError || !invoice) {
    return {
      success: false,
      error: createFlowError(
        404,
        'NOT_FOUND',
        'Invoice not found.',
        'validation',
      ),
    };
  }

  const status = (invoice as Record<string, unknown>).status as string;
  if (status !== 'sent' && status !== 'viewed') {
    return {
      success: false,
      error: createFlowError(
        400,
        'FINANCIAL_INVALID_STATE',
        'Only sent or viewed invoices can be resent.',
        'financial',
      ),
    };
  }

  const paymentUrl = (invoice as Record<string, unknown>).payment_url as
    | string
    | null;
  if (!paymentUrl) {
    return {
      success: false,
      error: createFlowError(
        500,
        'MISSING_PAYMENT_URL',
        'Payment URL is missing.',
        'system',
      ),
    };
  }

  const client =
    (invoice as unknown as { clients: Record<string, unknown> }).clients ?? {};
  const clientEmail = (client.email as string) ?? '';
  const clientName = (client.name as string) ?? '';
  const workspaceName =
    ((invoice as unknown as { workspaces: Record<string, unknown> }).workspaces
      ?.name as string) ?? '';

  if (!clientEmail) {
    return {
      success: false,
      error: createFlowError(
        400,
        'CLIENT_NO_EMAIL',
        'Client has no primary email address.',
        'validation',
      ),
    };
  }

  const provider = getTransactionalEmailProvider('resend');
  let messageId: string;
  try {
    const result = await provider.send(
      buildEmailPayload({
        to: clientEmail,
        invoiceNumber:
          ((invoice as Record<string, unknown>).invoice_number as string) ?? '',
        totalCents: Number(
          (invoice as Record<string, unknown>).total_cents ?? 0,
        ),
        currency:
          ((invoice as Record<string, unknown>).currency as string) ?? 'usd',
        clientName,
        paymentUrl,
        workspaceName,
        metadata: { invoice_id: invoiceId, workspace_id: ctx.workspaceId },
      }),
    );
    messageId = result.messageId;
  } catch {
    await supabase.from('audit_log').insert({
      workspace_id: ctx.workspaceId,
      user_id: ctx.userId,
      action: 'delivery_failed',
      entity_type: 'invoice',
      entity_id: invoiceId,
      details: { error: 'Resend failed on resend attempt' },
    });
    return {
      success: false,
      error: createFlowError(
        500,
        'EMAIL_ERROR',
        "We couldn't send the email — check the client's email address.",
        'financial',
      ),
    };
  }

  // Upsert delivery record
  const nowIso = new Date().toISOString();
  const { data: existingDelivery } = await supabase
    .from('invoice_deliveries')
    .select('id')
    .eq('invoice_id', invoiceId)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();

  if (existingDelivery) {
    await supabase
      .from('invoice_deliveries')
      .update({
        status: 'sent',
        sent_at: nowIso,
        message_id: messageId,
        retry_count: 0,
      })
      .eq('id', (existingDelivery as Record<string, unknown>).id as string);
  } else {
    await supabase.from('invoice_deliveries').insert({
      invoice_id: invoiceId,
      workspace_id: ctx.workspaceId,
      status: 'sent',
      sent_at: nowIso,
      message_id: messageId,
    });
  }

  revalidateTag(cacheTag('invoice', ctx.workspaceId));
  invalidateAfterMutation('invoice', 'update', ctx.workspaceId);

  return { success: true, data: { invoiceId, messageId } };
}
