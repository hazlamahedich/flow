import crypto from 'node:crypto';
import { getServerSupabase } from '@/lib/supabase-server';
import { createFlowError } from '@flow/db';

type SupabaseClient = Awaited<ReturnType<typeof getServerSupabase>>;

export interface InvoiceForPayment {
  status: string;
  totalCents: number;
  amountPaidCents: number;
  clientId: string;
  clientName: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  notes: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
  paymentUrl: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  deliveryToken: string | null;
  version: number;
}

export async function fetchInvoiceForPayment(
  supabase: SupabaseClient,
  invoiceId: string,
  workspaceId: string,
): Promise<InvoiceForPayment | { error: ReturnType<typeof createFlowError> }> {
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select(
      'id, status, total_cents, amount_paid_cents, credit_balance_cents, version, client_id, invoice_number, issue_date, due_date, currency, notes, voided_at, void_reason, created_at, payment_url, sent_at, viewed_at, delivery_token, clients(name)',
    )
    .eq('id', invoiceId)
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (invoiceError) {
    return {
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        'Failed to fetch invoice.',
        'system',
      ),
    };
  }

  if (!invoice) {
    return {
      error: createFlowError(
        404,
        'NOT_FOUND',
        'Invoice not found.',
        'validation',
      ),
    };
  }

  const inv = invoice as Record<string, unknown>;
  const clientData = inv.clients as Record<string, unknown> | null;

  return {
    status: inv.status as string,
    totalCents: Number(inv.total_cents ?? 0),
    amountPaidCents: Number(inv.amount_paid_cents ?? 0),
    clientId: inv.client_id as string,
    clientName: (clientData?.name ?? '') as string,
    invoiceNumber: inv.invoice_number as string,
    issueDate: String(inv.issue_date),
    dueDate: String(inv.due_date),
    currency: inv.currency as string,
    notes: inv.notes as string | null,
    voidedAt: inv.voided_at as string | null,
    voidReason: inv.void_reason as string | null,
    createdAt: String(inv.created_at),
    paymentUrl: inv.payment_url as string | null,
    sentAt: inv.sent_at as string | null,
    viewedAt: inv.viewed_at as string | null,
    deliveryToken: inv.delivery_token as string | null,
    version: Number(inv.version ?? 1),
  };
}

const TRANSIENT_RETRY_COUNT = 2;
const TRANSIENT_BACKOFFS = [100, 400];
const sleep = (ms: number): Promise<void> =>
  new Promise((res) => setTimeout(res, ms));

export async function callPaymentRpcWithRetry(
  supabase: SupabaseClient,
  params: {
    invoiceId: string;
    workspaceId: string;
    amountCents: number;
    paymentMethod: string;
    paymentDate: string;
    notes: string | undefined;
    createdBy: string;
    idempotencyKey: string | undefined;
  },
): Promise<
  | {
      paymentId: string;
      newStatus: string;
      newAmountPaid: number;
      newCreditBalance: number;
    }
  | { error: ReturnType<typeof createFlowError> }
> {
  for (let attempt = 0; attempt <= TRANSIENT_RETRY_COUNT; attempt++) {
    if (attempt > 0) await sleep(TRANSIENT_BACKOFFS[attempt - 1] ?? 400);

    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      'record_payment_with_concurrency',
      {
        p_invoice_id: params.invoiceId,
        p_workspace_id: params.workspaceId,
        p_amount_cents: params.amountCents,
        p_payment_method: params.paymentMethod,
        p_payment_date: params.paymentDate,
        p_notes: params.notes ?? null,
        p_stripe_payment_intent_id: null,
        p_created_by: params.createdBy,
        p_key_hash: params.idempotencyKey
          ? crypto
              .createHash('sha256')
              .update(`${params.invoiceId}::${params.idempotencyKey}`)
              .digest('hex')
          : null,
        p_key_scope: params.idempotencyKey
          ? `${params.workspaceId}:${params.invoiceId}`
          : null,
      },
    );

    if (rpcError) {
      const businessError = handleRpcError(
        rpcError as unknown as { message?: string; code?: string } & Record<
          string,
          unknown
        >,
      );
      if (businessError) return { error: businessError };
      continue;
    }

    if (!rpcResult) {
      return {
        error: createFlowError(
          500,
          'INTERNAL_ERROR',
          'Payment recording returned no result.',
          'system',
        ),
      };
    }

    const result = rpcResult as Record<string, unknown>;

    if (result.error) {
      const businessError = handleRpcResultError(result.error as string);
      if (businessError) return { error: businessError };
      continue;
    }

    return {
      paymentId: result.payment_id as string,
      newStatus: result.new_status as string,
      newAmountPaid: Number(result.amount_paid_cents),
      newCreditBalance: Number(result.credit_balance_cents),
    };
  }

  return {
    error: createFlowError(
      503,
      'CONCURRENT_PAYMENT_CONFLICT',
      'Payment recording failed after retries. Please try again.',
      'system',
    ),
  };
}

function handleRpcError(
  rpcError: { message?: string; code?: string } & Record<string, unknown>,
): ReturnType<typeof createFlowError> | null {
  const msg = rpcError.message ?? '';
  const code = (rpcError as unknown as Record<string, unknown>).code as
    | string
    | undefined;
  const checks: [string, string][] = [
    ['INVOICE_VOIDED', 'Cannot record payment on a voided invoice.'],
    ['INVOICE_ALREADY_PAID', 'Invoice is already paid.'],
    ['INVOICE_DRAFT', 'Cannot record payment on a draft invoice.'],
    ['INVALID_AMOUNT', 'Payment amount must be greater than zero.'],
  ];
  for (const [errCode, msgText] of checks) {
    if (msg.includes(errCode) || code === errCode) {
      return createFlowError(
        400,
        errCode as 'INVOICE_VOIDED',
        msgText,
        'financial',
      );
    }
  }
  return null;
}

function handleRpcResultError(errCode: string) {
  const map: Record<string, { status: number; msg: string }> = {
    INVOICE_VOIDED: {
      status: 400,
      msg: 'Cannot record payment on a voided invoice.',
    },
    INVOICE_ALREADY_PAID: { status: 400, msg: 'Invoice is already paid.' },
    INVOICE_DRAFT: {
      status: 400,
      msg: 'Cannot record payment on a draft invoice.',
    },
    NOT_FOUND: { status: 404, msg: 'Invoice not found.' },
    INVALID_AMOUNT: {
      status: 400,
      msg: 'Payment amount must be greater than zero.',
    },
  };
  const entry = map[errCode];
  if (entry) {
    return createFlowError(
      entry.status,
      errCode as 'INVOICE_VOIDED',
      entry.msg,
      'financial',
    );
  }
  return null;
}
