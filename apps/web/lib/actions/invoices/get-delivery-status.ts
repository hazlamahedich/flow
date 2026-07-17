'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, createFlowError } from '@flow/db';
import { getDeliveryStatusSchema } from '@flow/types';
import type { ActionResult, InvoiceDelivery } from '@flow/types';

export async function getDeliveryStatusAction(
  input: unknown,
): Promise<ActionResult<InvoiceDelivery | null>> {
  const parsed = getDeliveryStatusSchema.safeParse(input);
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

  const { data, error } = await supabase
    .from('invoice_deliveries')
    .select('*')
    .eq('invoice_id', invoiceId)
    .eq('workspace_id', ctx.workspaceId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        'Failed to fetch delivery status.',
        'system',
      ),
    };
  }

  if (!data) {
    return { success: true, data: null };
  }

  const row = data as Record<string, unknown>;
  const rawLog = (row.attempt_log as unknown[] | null) ?? [];
  const attemptLog = rawLog.map((entry) => {
    const r = entry as Record<string, unknown>;
    const attemptedAt = (r.attempted_at ?? r.attemptedAt) as string;
    const error = (r.error as string) ?? undefined;
    const providerResponse = (r.provider_response ?? r.providerResponse) as
      | Record<string, unknown>
      | undefined;
    return {
      attemptedAt,
      ...(error !== undefined && { error }),
      ...(providerResponse !== undefined && { providerResponse }),
    };
  });
  const delivery: InvoiceDelivery = {
    id: row.id as string,
    invoiceId: row.invoice_id as string,
    workspaceId: row.workspace_id as string,
    status: row.status as InvoiceDelivery['status'],
    sentAt: (row.sent_at as string) ?? null,
    retryCount: Number(row.retry_count ?? 0),
    lastError: (row.last_error as string) ?? null,
    messageId: (row.message_id as string) ?? null,
    attemptLog,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };

  return { success: true, data: delivery };
}
