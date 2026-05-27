'use server';

import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';
import {
  requireTenantContext,
  createFlowError,
  cacheTag,
  invalidateAfterMutation,
  getInvoiceWithBalance,
} from '@flow/db';
import { voidInvoiceSchema } from '@flow/types';
import type { ActionResult } from '@flow/types';
import type { InvoiceWithPaymentsAndBalance } from '@flow/db';

export async function voidInvoiceAction(
  input: unknown,
): Promise<ActionResult<InvoiceWithPaymentsAndBalance>> {
  const parsed = voidInvoiceSchema.safeParse(input);
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

  const { invoiceId, reason } = parsed.data;

  const { data: rpcResult, error: rpcError } = await supabase
    .rpc('void_invoice_and_clear_time_entries', {
      p_invoice_id: invoiceId,
      p_workspace_id: ctx.workspaceId,
      p_void_reason: reason,
    });

  if (rpcError) {
    const msg = rpcError.message ?? '';
    if (msg.includes('INVOICE_PAID_CANNOT_VOID')) {
      return {
        success: false,
        error: createFlowError(400, 'INVOICE_PAID_CANNOT_VOID', 'Paid invoices cannot be voided. Issue a credit note instead.', 'financial'),
      };
    }
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to void invoice.', 'system'),
    };
  }

  const result = rpcResult as Record<string, unknown> | null;

  if (result?.error === 'NOT_FOUND') {
    return {
      success: false,
      error: createFlowError(404, 'NOT_FOUND', 'Invoice not found.', 'validation'),
    };
  }

  if (result?.error === 'INVOICE_PAID_CANNOT_VOID') {
    return {
      success: false,
      error: createFlowError(400, 'INVOICE_PAID_CANNOT_VOID', 'Paid invoices cannot be voided. Issue a credit note instead.', 'financial'),
    };
  }

  if (!result?.success) {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to void invoice.', 'system'),
    };
  }

  const priorStatus = String(result.prior_status ?? 'unknown');

  const detail = await getInvoiceWithBalance(supabase, invoiceId, ctx.workspaceId);

  if (!detail) {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Invoice voided but could not re-fetch detail.', 'system'),
    };
  }

  revalidateTag(cacheTag('invoice', ctx.workspaceId));
  invalidateAfterMutation('invoice', 'update', ctx.workspaceId);

  const { error: auditError } = await supabase.from('audit_log').insert({
    workspace_id: ctx.workspaceId,
    user_id: ctx.userId,
    action: 'voided',
    entity_type: 'invoice',
    entity_id: invoiceId,
    details: { reason, priorStatus, timeEntriesCleared: result.time_entries_cleared },
  });

  if (auditError) {
    console.error('Audit log write failed for invoice void:', auditError.message);
  }

  return { success: true, data: detail };
}
