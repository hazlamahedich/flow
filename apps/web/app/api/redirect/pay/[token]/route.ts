/**
 * Route Handler: /api/redirect/pay/[token]
 * Verifies JWT token, records view, redirects to Stripe checkout URL.
 */
import { NextResponse } from 'next/server';
import { verifyDeliveryToken } from '@flow/agents/providers';
import { createServiceClient } from '@flow/db';

// Simple in-memory rate limiter (30 req/min per IP)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count += 1;
  return entry.count > 30;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;
  const requestIp =
    _request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  if (isRateLimited(requestIp)) {
    return new NextResponse('Too many requests. Try again later.', {
      status: 429,
    });
  }

  let payload: { invoiceId: string; workspaceId: string };
  try {
    payload = await verifyDeliveryToken(token);
  } catch {
    return new NextResponse('Invalid or expired payment link.', {
      status: 400,
    });
  }

  const supabase = createServiceClient();

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('id, status, payment_url')
    .eq('id', payload.invoiceId)
    .eq('workspace_id', payload.workspaceId)
    .maybeSingle();

  if (error || !invoice) {
    return new NextResponse('Invoice not found.', { status: 404 });
  }

  const status = (invoice as Record<string, unknown>).status as string;
  if (status === 'voided') {
    return new NextResponse('This invoice has been voided.', { status: 410 });
  }

  const paymentUrl = (invoice as Record<string, unknown>).payment_url as
    | string
    | null;
  if (!paymentUrl) {
    return new NextResponse('Payment link unavailable.', { status: 404 });
  }

  // Update viewed_at and transition status if currently sent
  const nowIso = new Date().toISOString();
  if (status === 'sent') {
    const { error: viewError } = await supabase
      .from('invoices')
      .update({ status: 'viewed', viewed_at: nowIso })
      .eq('id', payload.invoiceId)
      .eq('workspace_id', payload.workspaceId)
      .eq('status', 'sent');

    if (!viewError) {
      await supabase.from('audit_log').insert({
        workspace_id: payload.workspaceId,
        user_id: null,
        action: 'status_change',
        entity_type: 'invoice',
        entity_id: payload.invoiceId,
        details: { from: 'sent', to: 'viewed' },
      });
    }
  } else if (status !== 'viewed') {
    await supabase
      .from('invoices')
      .update({ viewed_at: nowIso })
      .eq('id', payload.invoiceId)
      .eq('workspace_id', payload.workspaceId);
  }

  return NextResponse.redirect(paymentUrl);
}
