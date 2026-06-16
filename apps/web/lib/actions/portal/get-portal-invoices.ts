/**
 * Portal invoice list query (read-only).
 *
 * Uses createPortalClient (portal JWT-scoped, read-only). RLS hides draft/voided
 * invoices and cross-client rows automatically.
 *
 * Story 9.2 — AC2 (FR51).
 */
'use server';

import { createPortalClient } from '@flow/auth/server/portal-client';
import { createFlowError } from '@flow/db';
import type { ActionResult } from '@flow/types';
import { PORTAL_SESSION_MAX_AGE_SECONDS } from './constants';
import type { PortalContext } from './helpers';

export interface PortalInvoiceListItem {
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
  paymentUrl: string | null;
  paymentUrlExpiresAt: string | null;
  stripeCheckoutSessionId: string | null;
  createdAt: string;
}

const INVOICE_SELECT_COLUMNS =
  'id, invoice_number, status, issue_date, due_date, total_cents, amount_paid_cents, credit_balance_cents, currency, payment_url, payment_url_expires_at, stripe_checkout_session_id, created_at';

export async function getPortalInvoices(
  portalCtx: PortalContext,
): Promise<ActionResult<{ invoices: PortalInvoiceListItem[] }>> {
  const client = await createPortalClient(portalCtx, PORTAL_SESSION_MAX_AGE_SECONDS);

  const { data, error } = await client
    .from('invoices')
    .select(INVOICE_SELECT_COLUMNS)
    .order('created_at', { ascending: false });

  if (error) {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to fetch invoices.', 'system'),
    };
  }

  const invoices: PortalInvoiceListItem[] = (data ?? []).map((r: Record<string, unknown>) => {
    const total = Number(r.total_cents ?? 0);
    const paid = Number(r.amount_paid_cents ?? 0);
    const credit = Number(r.credit_balance_cents ?? 0);
    return {
      id: r.id as string,
      invoiceNumber: r.invoice_number as string,
      status: r.status as string,
      issueDate: String(r.issue_date),
      dueDate: String(r.due_date),
      totalCents: total,
      amountPaidCents: paid,
      creditBalanceCents: credit,
      balanceCents: Math.max(total - paid - credit, 0),
      currency: r.currency as string,
      paymentUrl: (r.payment_url as string) ?? null,
      paymentUrlExpiresAt: (r.payment_url_expires_at as string) ?? null,
      stripeCheckoutSessionId: (r.stripe_checkout_session_id as string) ?? null,
      createdAt: String(r.created_at),
    };
  });

  return { success: true, data: { invoices } };
}
