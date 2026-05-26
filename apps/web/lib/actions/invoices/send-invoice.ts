'use server';

import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';
import {
  requireTenantContext,
  createFlowError,
  cacheTag,
  invalidateAfterMutation,
} from '@flow/db';
import { sendInvoiceSchema } from '@flow/types';
import type { ActionResult, InvoiceDelivery } from '@flow/types';
import { getPaymentProvider, getTransactionalEmailProvider, signDeliveryToken } from '@flow/agents/providers';
import { formatCentsToDollar } from '@flow/shared';

interface SendInvoicePayload {
  invoiceId: string;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
  <p style="color:#666;font-size:12px;">If the button doesn't work, copy this link: ${encodeURI(args.paymentUrl)}\u003c/p>
</body></html>`,
    textBody: `Dear ${args.clientName},

Here is your invoice ${args.invoiceNumber} for ${args.currency.toUpperCase()} ${totalDollars}.

Pay here: ${args.paymentUrl}

- Flow OS`,
    metadata: args.metadata,
  };
}

function plainLanguageError(stripeError?: boolean, resendError?: boolean): string {
  if (stripeError) return "We couldn't connect to the payment processor — please try again.";
  if (resendError) return "We couldn't send the email — check the client's email address.";
  return "Something went wrong — please copy the payment link and send it manually.";
}

export async function sendInvoiceAction(
  input: unknown,
): Promise<ActionResult<{ invoiceId: string; paymentUrl: string; deliveryId: string }>> {
  const parsed = sendInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', parsed.error.message, 'validation', {
        issues: parsed.error.issues,
      }),
    };
  }

  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  const { invoiceId } = parsed.data;

  const { data: invoice, error: fetchError } = await supabase
    .from('invoices')
    .select('id, workspace_id, client_id, invoice_number, status, total_cents, currency, due_date, clients(name, email), workspaces(name)')
    .eq('id', invoiceId)
    .eq('workspace_id', ctx.workspaceId)
    .single();

  if (fetchError || !invoice) {
    return {
      success: false,
      error: createFlowError(404, 'NOT_FOUND', 'Invoice not found.', 'validation'),
    };
  }

  const status = (invoice as Record<string, unknown>).status as string;
  if (status !== 'draft') {
    return {
      success: false,
      error: createFlowError(400, 'FINANCIAL_INVALID_STATE', 'Only draft invoices can be sent.', 'financial'),
    };
  }

  const client = (invoice as unknown as { clients: Record<string, unknown> }).clients ?? {};
  const clientEmail = (client.email as string) ?? '';
  const clientName = (client.name as string) ?? '';
  const workspaceName = ((invoice as unknown as { workspaces: Record<string, unknown> }).workspaces?.name as string) ?? '';

  if (!clientEmail) {
    return {
      success: false,
      error: createFlowError(400, 'CLIENT_NO_EMAIL', 'Client has no primary email address.', 'validation'),
    };
  }

  const totalCents = Number((invoice as Record<string, unknown>).total_cents ?? 0);
  const currency = ((invoice as Record<string, unknown>).currency as string) ?? 'usd';
  const invoiceNumber = ((invoice as Record<string, unknown>).invoice_number as string) ?? '';
  const dueDate = ((invoice as Record<string, unknown>).due_date as string) ?? '';

  const token = await signDeliveryToken({ invoiceId: invoice.id, workspaceId: ctx.workspaceId });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.flow.app';
  const redirectUrl = `${appUrl}/api/redirect/pay/${encodeURIComponent(token)}`;
  const successUrl = `${appUrl}/invoices/paid?token=${encodeURIComponent(token)}&status=success`;
  const cancelUrl = `${appUrl}/invoices/paid?token=${encodeURIComponent(token)}&status=cancelled`;

  // Expire at earlier of due_date EOD UTC or sent_at + 7 days
  const dueDateMs = dueDate ? new Date(`${dueDate}T23:59:59Z`).getTime() : Infinity;
  const sevenDaysMs = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const expiresAtUnix = Math.floor(Math.min(dueDateMs, sevenDaysMs) / 1000);

  const paymentProvider = getPaymentProvider('stripe');
  let checkout: { url: string; sessionId: string };
  try {
    checkout = await paymentProvider.createCheckoutSession({
      amountCents: totalCents,
      currency,
      invoiceNumber,
      metadata: {
        workspace_id: ctx.workspaceId,
        invoice_id: invoiceId,
        client_id: (invoice as Record<string, unknown>).client_id as string,
      },
      successUrl,
      cancelUrl,
      expiresAt: expiresAtUnix,
      idempotencyKey: `invoice-${invoiceId}-${ctx.workspaceId}`,
    });
  } catch {
    return {
      success: false,
      error: createFlowError(
        500,
        'STRIPE_ERROR',
        plainLanguageError(true, false),
        'financial',
      ),
    };
  }

  // Insert delivery record
  const { data: delivery, error: deliveryError } = await supabase
    .from('invoice_deliveries')
    .insert({
      invoice_id: invoiceId,
      workspace_id: ctx.workspaceId,
      status: 'pending',
    })
    .select('id')
    .single();

  if (deliveryError || !delivery) {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to create delivery record.', 'system'),
    };
  }

  const deliveryId = (delivery as Record<string, unknown>).id as string;

  // Send transactional email
  const emailProvider = getTransactionalEmailProvider('resend');
  let messageId: string | undefined;
  try {
    const result = await emailProvider.send(
      buildEmailPayload({
        to: clientEmail,
        invoiceNumber,
        totalCents,
        currency,
        clientName,
        paymentUrl: checkout.url,
        workspaceName,
        metadata: {
          invoice_id: invoiceId,
          workspace_id: ctx.workspaceId,
          delivery_id: deliveryId,
        },
      }),
    );
    messageId = result.messageId;
  } catch {
    // Update delivery to failed, still return success with paymentUrl so user can fallback
    await supabase
      .from('invoice_deliveries')
      .update({ status: 'failed', last_error: plainLanguageError(false, true), retry_count: 1 })
      .eq('id', deliveryId);

    // AC7 audit log for delivery failure
    await supabase.from('audit_log').insert({
      workspace_id: ctx.workspaceId,
      user_id: ctx.userId,
      action: 'delivery_failed',
      entity_type: 'invoice',
      entity_id: invoiceId,
      details: { error: plainLanguageError(false, true), retryCount: 1 },
    });

    return {
      success: false,
      error: createFlowError(500, 'EMAIL_ERROR', plainLanguageError(false, true), 'financial'),
    };
  }

  // Update invoice to sent and store payment_url
  const nowIso = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('invoices')
    .update({ status: 'sent', sent_at: nowIso, payment_url: checkout.url, delivery_token: token })
    .eq('id', invoiceId)
    .eq('workspace_id', ctx.workspaceId);

  if (updateError) {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to update invoice status.', 'system'),
    };
  }

  // Mark referenced time entries as invoiced
  const { data: lineItemTimeEntries } = await supabase
    .from('invoice_line_items')
    .select('time_entry_id')
    .eq('invoice_id', invoiceId)
    .not('time_entry_id', 'is', null);

  const invoicedTimeEntryIds = ((lineItemTimeEntries ?? []) as Array<{ time_entry_id: string | null }>)
    .map((te) => te.time_entry_id)
    .filter((id): id is string => id !== null);

  if (invoicedTimeEntryIds.length > 0) {
    const { error: teMarkError } = await supabase
      .from('time_entries')
      .update({ invoiced_at: nowIso })
      .in('id', invoicedTimeEntryIds)
      .eq('workspace_id', ctx.workspaceId);

    if (teMarkError) {
      console.error('Failed to mark time entries as invoiced:', teMarkError.message, { invoiceId, timeEntryIds: invoicedTimeEntryIds });
    }
  }

  // Update delivery to sent
  await supabase
    .from('invoice_deliveries')
    .update({ status: 'sent', sent_at: nowIso, message_id: messageId })
    .eq('id', deliveryId);

  // AC7 audit log for status change
  await supabase.from('audit_log').insert({
    workspace_id: ctx.workspaceId,
    user_id: ctx.userId,
    action: 'status_change',
    entity_type: 'invoice',
    entity_id: invoiceId,
    details: { from: 'draft', to: 'sent', paymentUrl: checkout.url, messageId },
  });

  revalidateTag(cacheTag('invoice', ctx.workspaceId));
  invalidateAfterMutation('invoice', 'update', ctx.workspaceId);

  return { success: true, data: { invoiceId, paymentUrl: checkout.url, deliveryId } };
}
