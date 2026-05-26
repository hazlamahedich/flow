'use server';

import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, createFlowError, cacheTag } from '@flow/db';
import { updateInvoiceSchema } from '@flow/types';
import type { ActionResult } from '@flow/types';
import { computeTimeEntryAmount, formatTimeEntryDescription } from '@flow/shared';

type DbLineItem = {
  invoice_id: string;
  workspace_id: string;
  source_type: string;
  retainer_id?: string;
  time_entry_id?: string;
  description: string;
  quantity: string;
  unit_price_cents: number;
  amount_cents: number;
  sort_order: number;
};

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
    .select('status, workspace_id, client_id')
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

  const clientId = (invoice as Record<string, unknown>).client_id as string;
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (notes !== undefined) updateData.notes = notes;
  if (issueDate !== undefined) updateData.issue_date = issueDate;
  if (dueDate !== undefined) updateData.due_date = dueDate;

  if (lineItems) {
    // Find currently referenced time entries to clear invoiced_at if removed
    const { data: existingItems } = await supabase
      .from('invoice_line_items')
      .select('time_entry_id')
      .eq('invoice_id', invoiceId)
      .eq('source_type', 'time_entry');

    const existingTimeEntryIds = new Set(
      ((existingItems as Array<Record<string, unknown>>) ?? [])
        .map((row) => row.time_entry_id as string)
        .filter(Boolean)
    );

    const newTimeEntryIds = new Set(
      lineItems
        .filter((li) => li.sourceType === 'time_entry')
        .map((li) => li.timeEntryId)
    );

    const removedTimeEntryIds = [...existingTimeEntryIds].filter((id) => !newTimeEntryIds.has(id));

    // Check for time entries already on other invoices
    const timeEntryIds = [...newTimeEntryIds];
    if (timeEntryIds.length > 0) {
      const alreadyOnInvoice = timeEntryIds.filter((id) => !existingTimeEntryIds.has(id));
      if (alreadyOnInvoice.length > 0) {
        const { data: dupCheck, error: dedupError } = await supabase
          .from('invoice_line_items')
          .select('time_entry_id')
          .in('time_entry_id', alreadyOnInvoice);
        if (dedupError) {
          return {
            success: false,
            error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to verify time entry availability.', 'system'),
          };
        }
        if (dupCheck && dupCheck.length > 0) {
          const dupIds = dupCheck.map((r: Record<string, unknown>) => r.time_entry_id as string);
          return {
            success: false,
            error: createFlowError(409, 'VALIDATION_ERROR', `Time entries already on another invoice: ${dupIds.join(', ')}`, 'validation'),
          };
        }
      }
    }

    let timeEntriesMap = new Map<string, { durationMinutes: number }>();
    if (timeEntryIds.length > 0) {
      const { data: timeRows, error: teError } = await supabase
        .from('time_entries')
        .select('id, duration_minutes')
        .in('id', timeEntryIds)
        .eq('workspace_id', ctx.workspaceId)
        .eq('client_id', clientId);

      if (teError || !timeRows) {
        return {
          success: false,
          error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to fetch time entries.', 'system'),
        };
      }

      timeEntriesMap = new Map(
        (timeRows as Array<Record<string, unknown>>).map((row) => [
          row.id as string,
          { durationMinutes: Number(row.duration_minutes) },
        ])
      );
    }

    // Resolve hourly rate
    const { data: rateResult } = await supabase
      .rpc('resolve_hourly_rate', { p_client_id: clientId, p_workspace_id: ctx.workspaceId });

    const hourlyRateCents = rateResult ? Number(rateResult) : null;

    const dbItems: DbLineItem[] = [];
    let totalCents = 0;

    for (const [index, item] of lineItems.entries()) {
      if (item.sourceType === 'time_entry') {
        const te = timeEntriesMap.get(item.timeEntryId);
        if (!te) {
          return {
            success: false,
            error: createFlowError(400, 'VALIDATION_ERROR', `Time entry ${item.timeEntryId} not found.`, 'validation'),
          };
        }

        if (hourlyRateCents == null || hourlyRateCents <= 0) {
          return {
            success: false,
            error: createFlowError(400, 'NO_HOURLY_RATE', 'No hourly rate configured for this client. Set a retainer or client rate first.', 'validation'),
          };
        }

        const amountCents = computeTimeEntryAmount(te.durationMinutes, hourlyRateCents);
        const quantity = te.durationMinutes / 60;

        dbItems.push({
          invoice_id: invoiceId,
          workspace_id: ctx.workspaceId,
          source_type: 'time_entry',
          time_entry_id: item.timeEntryId,
          description: formatTimeEntryDescription(item.description, te.durationMinutes),
          quantity: quantity.toFixed(2),
          unit_price_cents: hourlyRateCents,
          amount_cents: amountCents,
          sort_order: index + 1,
        });
        totalCents += amountCents;
      } else if (item.sourceType === 'retainer') {
        const amount = item.amountCents;
        dbItems.push({
          invoice_id: invoiceId,
          workspace_id: ctx.workspaceId,
          source_type: 'retainer',
          retainer_id: item.retainerId,
          description: item.description,
          quantity: item.quantity.toFixed(2),
          unit_price_cents: Math.round(amount / item.quantity),
          amount_cents: amount,
          sort_order: index + 1,
        });
        totalCents += amount;
      } else {
        dbItems.push({
          invoice_id: invoiceId,
          workspace_id: ctx.workspaceId,
          source_type: 'fixed_service',
          description: item.description,
          quantity: item.quantity.toFixed(2),
          unit_price_cents: Math.round(item.amountCents / item.quantity),
          amount_cents: item.amountCents,
          sort_order: index + 1,
        });
        totalCents += item.amountCents;
      }
    }

    // Clear invoiced_at on removed time entries (after validation passes)
    if (removedTimeEntryIds.length > 0) {
      await supabase
        .from('time_entries')
        .update({ invoiced_at: null })
        .in('id', removedTimeEntryIds)
        .eq('workspace_id', ctx.workspaceId);
    }

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

    const { error: insertError } = await supabase
      .from('invoice_line_items')
      .insert(dbItems);

    if (insertError) {
      return {
        success: false,
        error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to insert line items.', 'system'),
      };
    }

    updateData.total_cents = totalCents;
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
