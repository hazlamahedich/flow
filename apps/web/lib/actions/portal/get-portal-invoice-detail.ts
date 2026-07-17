/**
 * Portal invoice detail query (read-only).
 *
 * Returns invoice + line items + payments + value-receipt aggregate
 * (task count, meeting count from invoice_line_items).
 *
 * Story 9.2 — AC2, AC7 (FR51, UX-DR37).
 */
'use server';

import { createPortalClient } from '@flow/auth/server/portal-client';
import { createFlowError } from '@flow/db';
import type { ActionResult } from '@flow/types';
import { PORTAL_SESSION_MAX_AGE_SECONDS } from './constants';
import type { PortalContext } from './helpers';

export interface PortalInvoiceDetail {
  id: string;
  invoiceNumber: string;
  status: string;
  issueDate: string;
  dueDate: string;
  totalCents: number;
  amountPaidCents: number;
  creditBalanceCents: number;
  balanceCents: number;
  currency: string;
  notes: string | null;
  paymentUrl: string | null;
  paymentUrlExpiresAt: string | null;
  stripeCheckoutSessionId: string | null;
  createdAt: string;
  lineItems: Array<{
    id: string;
    description: string;
    quantity: string;
    amountCents: number;
    sourceType: string;
  }>;
  payments: Array<{
    amountCents: number;
    paymentDate: string;
    paymentMethod: string;
  }>;
  valueReceipt: {
    taskCount: number;
    meetingCount: number;
  };
}

export async function getPortalInvoiceDetail(
  portalCtx: PortalContext,
  invoiceId: string,
): Promise<ActionResult<PortalInvoiceDetail>> {
  const client = await createPortalClient(
    portalCtx,
    PORTAL_SESSION_MAX_AGE_SECONDS,
  );

  const { data: invoice, error: invError } = await client
    .from('invoices')
    .select(
      'id, invoice_number, status, issue_date, due_date, total_cents, amount_paid_cents, credit_balance_cents, currency, notes, payment_url, payment_url_expires_at, stripe_checkout_session_id, created_at',
    )
    .eq('id', invoiceId)
    .maybeSingle();

  if (invError || !invoice) {
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

  const inv = invoice as Record<string, unknown>;
  const total = Number(inv.total_cents ?? 0);
  const paid = Number(inv.amount_paid_cents ?? 0);
  const credit = Number(inv.credit_balance_cents ?? 0);

  const [{ data: lineItems }, { data: payments }] = await Promise.all([
    client
      .from('invoice_line_items')
      .select(
        'id, description, quantity, amount_cents, source_type, time_entry_id, calendar_event_id',
      )
      .eq('invoice_id', invoiceId)
      .order('sort_order', { ascending: true }),
    client
      .from('invoice_payments')
      .select('amount_cents, payment_date, payment_method')
      .eq('invoice_id', invoiceId)
      .order('payment_date', { ascending: false }),
  ]);

  const items = (lineItems ?? []) as Array<Record<string, unknown>>;
  const taskCount = items.filter((li) => li.time_entry_id !== null).length;
  const meetingCount = items.filter(
    (li) => li.calendar_event_id !== null,
  ).length;

  return {
    success: true,
    data: {
      id: inv.id as string,
      invoiceNumber: inv.invoice_number as string,
      status: inv.status as string,
      issueDate: String(inv.issue_date),
      dueDate: String(inv.due_date),
      totalCents: total,
      amountPaidCents: paid,
      creditBalanceCents: credit,
      balanceCents: Math.max(total - paid - credit, 0),
      currency: inv.currency as string,
      notes: (inv.notes as string) ?? null,
      paymentUrl: (inv.payment_url as string) ?? null,
      paymentUrlExpiresAt: (inv.payment_url_expires_at as string) ?? null,
      stripeCheckoutSessionId:
        (inv.stripe_checkout_session_id as string) ?? null,
      createdAt: String(inv.created_at),
      lineItems: items.map((li) => ({
        id: li.id as string,
        description: li.description as string,
        quantity: String(li.quantity),
        amountCents: Number(li.amount_cents),
        sourceType: li.source_type as string,
      })),
      payments: (payments ?? []).map((p: Record<string, unknown>) => ({
        amountCents: Number(p.amount_cents),
        paymentDate: String(p.payment_date),
        paymentMethod: p.payment_method as string,
      })),
      valueReceipt: { taskCount, meetingCount },
    },
  };
}
