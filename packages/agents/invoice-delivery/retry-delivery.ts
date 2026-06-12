import type { PgBoss } from 'pg-boss';
import { getTransactionalEmailProvider } from '../providers/registry.js';
import type { TransactionalEmailPayload } from '../providers/transactional-email-provider.js';

// Retry intervals in minutes per NFR48: 1, 5, 15
const RETRY_INTERVALS = [1, 5, 15] as const;

interface RetryPayload {
  deliveryId: string;
  workspaceId: string;
}

interface InvoiceDeliveryRow {
  id: string;
  invoice_id: string;
  status: string;
  retry_count: number;
  message_id: string | null;
  last_error: string | null;
}

interface SimpleSupabase {
  from(table: 'invoice_deliveries'): {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => {
          single: () => Promise<{ data: unknown; error: unknown }>;
        };
      };
    };
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => {
        eq: (column: string, value: string) => Promise<{ error: unknown }>;
      };
    };
  };
}

export async function scheduleRetry(
  boss: PgBoss,
  deliveryId: string,
  workspaceId: string,
  attemptCount: number,
): Promise<void> {
  const interval = RETRY_INTERVALS[attemptCount - 1] ?? RETRY_INTERVALS[RETRY_INTERVALS.length - 1] ?? 1;
  const retryAfter = new Date(Date.now() + interval * 60 * 1000);

  await boss.send('invoice:retry-delivery', { deliveryId, workspaceId } as RetryPayload, {
    retryLimit: 0,
    startAfter: retryAfter.toISOString(),
  });
}

export async function handleRetryDelivery(
  _boss: PgBoss,
  payload: RetryPayload,
  supabase: SimpleSupabase,
): Promise<void> {
  const { deliveryId, workspaceId } = payload;

  const { data, error } = await supabase
    .from('invoice_deliveries')
    .select(
      'id, invoice_id, status, retry_count, message_id, last_error',
    )
    .eq('id', deliveryId)
    .eq('workspace_id', workspaceId)
    .single();

  if (error || !data) {
    throw new Error(`Delivery record not found: ${deliveryId}`);
  }

  const record = data as unknown as InvoiceDeliveryRow;
  if (record.status !== 'failed') return;
  const retryCount = record.retry_count ?? 0;
  if (retryCount >= 3) return;

  // NOTE: In full implementation this would query invoice details,
  // reconstruct email payload, and call provider.
  // For 7-2 MVP we surface the retry scaffolding.

  await supabase.from('invoice_deliveries').update({
    last_error: 'Retry handler scaffold — full retry in 7-2b',
    retry_count: retryCount + 1,
  }).eq('id', deliveryId).eq('workspace_id', workspaceId);
}

function buildEmailPayload(args: {
  to: string;
  invoiceNumber: string;
  totalCents: number;
  currency: string;
  clientName: string;
  paymentUrl: string;
  metadata: Record<string, string>;
}): TransactionalEmailPayload {
  const totalDollars = (args.totalCents / 100).toFixed(2);
  return {
    to: args.to,
    subject: `Invoice ${args.invoiceNumber}`,
    htmlBody: `<!DOCTYPE html>
<html><body>
  <p>Dear ${escapeHtml(args.clientName)},\u003c/p>
  <p>Invoice \u003cstrong>${escapeHtml(args.invoiceNumber)}\u003c/strong> for ${args.currency.toUpperCase()} ${totalDollars}.\u003c/p>
  <a href="${encodeURI(args.paymentUrl)}" style="display:inline-block;padding:10px 16px;background:#0f172a;color:#fff;text-decoration:none;border-radius:4px;">Pay Invoice\u003c/a>
</body></html>`,
    textBody: `Dear ${args.clientName},\n\nInvoice ${args.invoiceNumber} for ${args.currency.toUpperCase()} ${totalDollars}.\n\nPay: ${args.paymentUrl}\n\n- Flow OS`,
    metadata: args.metadata,
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
