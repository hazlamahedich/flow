'use server';

import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, createFlowError, cacheTag } from '@flow/db';
import { updateInvoiceSchema } from '@flow/types';
import type { ActionResult } from '@flow/types';

export async function updateInvoiceAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = updateInvoiceSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', parsed.error.message, 'validation'),
    };
  }

  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  const { invoiceId, notes, issueDate, dueDate, lineItems } = parsed.data;

  const { data: invoice, error: fetchError } = await supabase
    .from('invoices')
    .select('status, workspace_id')
    .eq('id', invoiceId)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();

  if (fetchError || !invoice) {
    return {
      success: false,
      error: createFlowError(404, 'NOT_FOUND', 'Invoice not found.', 'validation'),
    };
  }

  if ((invoice as Record<string, unknown>).status !== 'draft') {
    return {
      success: false,
      error: createFlowError(400, 'FINANCIAL_INVALID_STATE', 'Only draft invoices can be edited.', 'financial'),
    };
  }

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (notes !== undefined) updateData.notes = notes;
  if (issueDate !== undefined) updateData.issue_date = issueDate;
  if (dueDate !== undefined) updateData.due_date = dueDate;

  if (lineItems) {
    const { error: deleteError } = await supabase
      .from('invoice_line_items')
      .delete()
      .eq('invoice_id', invoiceId);

    if (deleteError) {
      return {
        success: false,
        error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to update line items.', 'system'),
      };
    }

    const dbItems = lineItems.map((item, index) => {
      if (item.sourceType === 'time_entry') {
        return {
          invoice_id: invoiceId,
          workspace_id: ctx.workspaceId,
          source_type: 'time_entry',
          time_entry_id: item.timeEntryId,
          description: item.description,
          quantity: item.quantity.toFixed(2),
          unit_price_cents: 0,
          amount_cents: 0,
          sort_order: index + 1,
        };
      }
      if (item.sourceType === 'retainer') {
        return {
          invoice_id: invoiceId,
          workspace_id: ctx.workspaceId,
          source_type: 'retainer',
          retainer_id: item.retainerId,
          description: item.description,
          quantity: item.quantity.toFixed(2),
          unit_price_cents: Math.round(item.amountCents / item.quantity),
          amount_cents: item.amountCents,
          sort_order: index + 1,
        };
      }
      return {
        invoice_id: invoiceId,
        workspace_id: ctx.workspaceId,
        source_type: 'fixed_service',
        description: item.description,
        quantity: item.quantity.toFixed(2),
        unit_price_cents: Math.round(item.amountCents / item.quantity),
        amount_cents: item.amountCents,
        sort_order: index + 1,
      };
    });

    const { error: insertError } = await supabase
      .from('invoice_line_items')
      .insert(dbItems);

    if (insertError) {
      return {
        success: false,
        error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to insert line items.', 'system'),
      };
    }

    updateData.total_cents = lineItems.reduce((sum, li) => {
      if (li.sourceType === 'time_entry') return sum;
      return sum + li.amountCents;
    }, 0);
  }

  const { error: updateError } = await supabase
    .from('invoices')
    .update(updateData)
    .eq('id', invoiceId)
    .eq('workspace_id', ctx.workspaceId);

  if (updateError) {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to update invoice.', 'system'),
    };
  }

  revalidateTag(cacheTag('invoice', ctx.workspaceId));

  return { success: true, data: { id: invoiceId } };
}
