/**
 * Pay-invoice Server Action (portal).
 *
 * Mints a Stripe Checkout URL for the invoice balance (server-side computed).
 * Reuses an existing payment_url only when non-expired AND invoice is not
 * partially_paid. Otherwise mints fresh via getPaymentProvider('stripe') and
 * persists via refresh_portal_checkout_url SECURITY DEFINER RPC.
 *
 * Story 9.2 — AC3 (FR52).
 */
'use server';

import { z } from 'zod';
import { getServerSupabase } from '@/lib/supabase-server';
import { createPortalClient } from '@flow/auth/server/portal-client';
import { createFlowError } from '@flow/db';
import type { ActionResult } from '@flow/types';
import { getPaymentProvider } from '@flow/agents/providers';
import { PORTAL_SESSION_MAX_AGE_SECONDS } from './constants';
import { isRateLimited, createRateLimitError, getAppUrl } from './helpers';
import type { PortalContext } from './helpers';

const PAYABLE_STATUSES = new Set(['sent', 'viewed', 'partially_paid', 'overdue']);

const payInvoiceInputSchema = z.object({
  invoiceId: z.string().uuid(),
  slug: z.string().min(1),
});

const HOURS_PER_SESSION_EXPIRY = 24;

export async function payInvoicePortalAction(
  portalCtx: PortalContext,
  input: unknown,
): Promise<ActionResult<{ checkoutUrl: string }>> {
  const parsed = payInvoiceInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', parsed.error.message, 'validation'),
    };
  }

  const supabase = await getServerSupabase();

  const rlResult = await checkPayRateLimit(supabase, portalCtx.portalTokenId);
  if (rlResult.limited) {
    return { success: false, error: createRateLimitError(rlResult.retryAfterMs) };
  }

  const portalClient = await createPortalClient(portalCtx, PORTAL_SESSION_MAX_AGE_SECONDS);
  const { data: invoice, error } = await portalClient
    .from('invoices')
    .select(
      'id, client_id, workspace_id, invoice_number, status, total_cents, amount_paid_cents, credit_balance_cents, currency, payment_url, payment_url_expires_at',
    )
    .eq('id', parsed.data.invoiceId)
    .maybeSingle();

  if (error || !invoice) {
    return {
      success: false,
      error: createFlowError(404, 'NOT_FOUND', 'Invoice not found.', 'validation'),
    };
  }

  const inv = invoice as Record<string, unknown>;
  const status = inv.status as string;
  const totalCents = Number(inv.total_cents ?? 0);
  const amountPaidCents = Number(inv.amount_paid_cents ?? 0);
  const creditBalanceCents = Number(inv.credit_balance_cents ?? 0);
  const balanceCents = totalCents - amountPaidCents - creditBalanceCents;

  if (!PAYABLE_STATUSES.has(status) || balanceCents <= 0) {
    return {
      success: false,
      error: createFlowError(
        400,
        'FINANCIAL_INVALID_STATE',
        'This invoice cannot be paid at this time.',
        'financial',
      ),
    };
  }

  const existingUrl = inv.payment_url as string | null;
  const existingExpiry = inv.payment_url_expires_at as string | null;
  const isPartial = status === 'partially_paid';
  const urlStillValid = existingExpiry ? new Date(existingExpiry) > new Date() : false;

  if (existingUrl && urlStillValid && !isPartial) {
    return { success: true, data: { checkoutUrl: existingUrl } };
  }

  const portalOrigin = getAppUrl();
  const invoiceId = inv.id as string;
  const workspaceId = inv.workspace_id as string;
  const clientId = inv.client_id as string;
  const invoiceNumber = inv.invoice_number as string;
  const currency = inv.currency as string;
  const slug = parsed.data.slug;

  const successUrl = `${portalOrigin}/portal/${slug}/invoices/${invoiceId}?status=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${portalOrigin}/portal/${slug}/invoices/${invoiceId}?status=cancel`;
  const hourBucket = Math.floor(Date.now() / (60 * 60 * 1000));
  const idempotencyKey = `portal:${portalCtx.portalTokenId}:invoice:${invoiceId}:balance:${balanceCents}:${hourBucket}`;

  const paymentProvider = getPaymentProvider('stripe');
  let checkoutUrl: string;
  let sessionId: string;
  try {
    const checkout = await paymentProvider.createCheckoutSession({
      amountCents: balanceCents,
      currency,
      invoiceNumber,
      metadata: { workspaceId, invoiceId, clientId },
      successUrl,
      cancelUrl,
      idempotencyKey,
    });
    checkoutUrl = checkout.url;
    sessionId = checkout.sessionId;
  } catch {
    return {
      success: false,
      error: createFlowError(502, 'PROVIDER_ERROR', 'Payment provider error. Try again later.', 'financial'),
    };
  }

  const expiresAt = new Date(Date.now() + HOURS_PER_SESSION_EXPIRY * 60 * 60 * 1000).toISOString();
  const { data: rpcResult, error: rpcError } = await portalClient.rpc('refresh_portal_checkout_url', {
    p_invoice_id: invoiceId,
    p_client_id: portalCtx.clientId,
    p_checkout_url: checkoutUrl,
    p_session_id: sessionId,
    p_expires_at: expiresAt,
  });

  if (rpcError) {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to persist payment session.', 'system'),
    };
  }

  const rpcStatus = (rpcResult as string) ?? '';
  if (rpcStatus !== 'OK') {
    return {
      success: false,
      error: createFlowError(
        rpcStatus === 'FORBIDDEN' ? 403 : rpcStatus === 'NOT_FOUND' ? 404 : 422,
        rpcStatus === 'FORBIDDEN' ? 'FORBIDDEN' : rpcStatus === 'NOT_FOUND' ? 'NOT_FOUND' : 'FINANCIAL_INVALID_STATE',
        rpcStatus === 'FORBIDDEN'
          ? 'You do not have access to this invoice.'
          : rpcStatus === 'NOT_FOUND'
            ? 'Invoice not found.'
            : 'Payment session could not be created. Please try again.',
        rpcStatus === 'FORBIDDEN' ? 'auth' : rpcStatus === 'NOT_FOUND' ? 'validation' : 'financial',
      ),
    };
  }

  return { success: true, data: { checkoutUrl } };
}

async function checkPayRateLimit(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  portalTokenId: string,
): Promise<{ limited: true; retryAfterMs: number } | { limited: false }> {
  const { data: rlResult } = await supabase.rpc('check_rate_limit', {
    p_identifier: `pay_invoice:${portalTokenId}`,
    p_action: 'portal_pay_invoice',
    p_max_requests: 10,
    p_window_seconds: 60,
    p_min_interval_seconds: 0,
  });
  return isRateLimited(rlResult);
}
