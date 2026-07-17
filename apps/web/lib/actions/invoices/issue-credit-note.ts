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
import { issueCreditNoteSchema } from '@flow/types';
import type { ActionResult } from '@flow/types';
import type { InvoiceWithPaymentsAndBalance } from '@flow/db';

export async function issueCreditNoteAction(
  input: unknown,
): Promise<ActionResult<InvoiceWithPaymentsAndBalance>> {
  const parsed = issueCreditNoteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(
        400,
        'VALIDATION_ERROR',
        parsed.error.message,
        'validation',
        {
          issues: parsed.error.issues,
        },
      ),
    };
  }

  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  const { invoiceId, amountCents, reason } = parsed.data;

  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    'issue_credit_note',
    {
      p_invoice_id: invoiceId,
      p_workspace_id: ctx.workspaceId,
      p_amount_cents: amountCents,
      p_reason: reason,
      p_created_by: ctx.userId,
    },
  );

  if (rpcError) {
    const msg = rpcError.message ?? '';
    const codeMap: Record<
      string,
      {
        code:
          | 'CREDIT_EXCEEDS_BALANCE'
          | 'INVOICE_PAID_CANNOT_CREDIT'
          | 'INVOICE_VOIDED'
          | 'INVALID_AMOUNT';
        msg: string;
      }
    > = {
      CREDIT_EXCEEDS_BALANCE: {
        code: 'CREDIT_EXCEEDS_BALANCE',
        msg: 'Credit amount exceeds outstanding balance.',
      },
      INVOICE_PAID_CANNOT_CREDIT: {
        code: 'INVOICE_PAID_CANNOT_CREDIT',
        msg: 'Credit notes cannot be issued on paid invoices.',
      },
      INVOICE_VOIDED: {
        code: 'INVOICE_VOIDED',
        msg: 'Credit notes cannot be issued on voided invoices.',
      },
      INVALID_AMOUNT: {
        code: 'INVALID_AMOUNT',
        msg: 'Credit amount must be greater than zero.',
      },
    };

    for (const [key, mapped] of Object.entries(codeMap)) {
      if (msg.includes(key)) {
        return {
          success: false,
          error: createFlowError(400, mapped.code, mapped.msg, 'financial'),
        };
      }
    }

    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        'Failed to issue credit note.',
        'system',
      ),
    };
  }

  const result = rpcResult as Record<string, unknown> | null;

  if (!result || result.error) {
    const errCode = result?.error as string | undefined;
    const codeMap: Record<
      string,
      {
        code:
          | 'CREDIT_EXCEEDS_BALANCE'
          | 'INVOICE_PAID_CANNOT_CREDIT'
          | 'INVOICE_VOIDED'
          | 'INVALID_AMOUNT';
        msg: string;
      }
    > = {
      CREDIT_EXCEEDS_BALANCE: {
        code: 'CREDIT_EXCEEDS_BALANCE',
        msg: 'Credit amount exceeds outstanding balance.',
      },
      INVOICE_PAID_CANNOT_CREDIT: {
        code: 'INVOICE_PAID_CANNOT_CREDIT',
        msg: 'Credit notes cannot be issued on paid invoices.',
      },
      INVOICE_VOIDED: {
        code: 'INVOICE_VOIDED',
        msg: 'Credit notes cannot be issued on voided invoices.',
      },
      INVALID_AMOUNT: {
        code: 'INVALID_AMOUNT',
        msg: 'Credit amount must be greater than zero.',
      },
    };

    const mapped = errCode ? codeMap[errCode] : undefined;
    if (mapped) {
      return {
        success: false,
        error: createFlowError(400, mapped.code, mapped.msg, 'financial'),
      };
    }

    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        'Failed to issue credit note.',
        'system',
      ),
    };
  }

  const detail = await getInvoiceWithBalance(
    supabase,
    invoiceId,
    ctx.workspaceId,
  );

  if (!detail) {
    return {
      success: false,
      error: createFlowError(
        500,
        'INTERNAL_ERROR',
        'Credit note issued but could not re-fetch invoice detail.',
        'system',
      ),
    };
  }

  revalidateTag(cacheTag('invoice', ctx.workspaceId));
  invalidateAfterMutation('invoice', 'update', ctx.workspaceId);

  const { error: auditError } = await supabase.from('audit_log').insert([
    {
      workspace_id: ctx.workspaceId,
      user_id: ctx.userId,
      action: 'credit_note_issued',
      entity_type: 'invoice',
      entity_id: invoiceId,
      details: { creditNoteId: result.credit_note_id, amountCents, reason },
    },
    {
      workspace_id: ctx.workspaceId,
      user_id: ctx.userId,
      action: 'credit_balance_change',
      entity_type: 'invoice',
      entity_id: invoiceId,
      details: {
        amountCents,
        newCreditBalance: result.new_credit_balance_cents,
        reason,
      },
    },
  ]);

  if (auditError) {
    console.error(
      'Audit log write failed for credit note:',
      auditError.message,
    );
  }

  return { success: true, data: detail };
}
