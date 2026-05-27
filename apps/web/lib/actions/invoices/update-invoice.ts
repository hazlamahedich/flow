'use server';

import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, createFlowError, cacheTag } from '@flow/db';
import { updateInvoiceSchema } from '@flow/types';
import type { ActionResult } from '@flow/types';

import { resolveTimeEntryDurations } from './resolve-time-entries';
import { checkDuplicateTimeEntries } from './create-invoice-helpers';
import { buildLineItemsAndTotal } from './build-invoice-line-items';

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
  // -- Validation
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

  // -- Fetch and validate invoice
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

  if (!lineItems) {
    await supabase.from('invoices').update(updateData).eq('id', invoiceId);
    revalidateTag(cacheTag('invoice', ctx.workspaceId));
    return { success: true, data: { id: invoiceId } };
  }

  // -- Find currently referenced time entries
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
  const addedTimeEntryIds = [...newTimeEntryIds].filter((id) => !existingTimeEntryIds.has(id));

  // -- Duplicate check for newly added time entries
  if (addedTimeEntryIds.length > 0) {
    const dupCheck = await checkDuplicateTimeEntries(supabase, ctx.workspaceId, clientId, addedTimeEntryIds);
    if (dupCheck) return dupCheck;
  }

  // -- Resolve durations for time entries
  const allTimeEntryIds = [...newTimeEntryIds];
  let timeEntriesMap = new Map<string, { durationMinutes: number }>();
  if (allTimeEntryIds.length > 0) {
    const resolved = await resolveTimeEntryDurations(supabase, ctx.workspaceId, clientId, allTimeEntryIds);
    if (!resolved.success) return resolved;
    timeEntriesMap = resolved.data;
  }

  // -- Resolve hourly rate
  const { data: rateResult } = await supabase
    .rpc('resolve_hourly_rate', { p_client_id: clientId, p_workspace_id: ctx.workspaceId });
  const hourlyRateCents = rateResult ? Number(rateResult) : null;

  // -- Build line items and total
  // Note: We need to convert buildLineItemsAndTotal result to the update-specific DbLineItem shape (invoice_id + workspace_id)
  const built = buildLineItemsAndTotal(lineItems, timeEntriesMap, hourlyRateCents);
  if (!built.success) return built;

  const dbItems: DbLineItem[] = built.data.dbLineItems.map((li) => ({
    ...li,
    invoice_id: invoiceId,
    workspace_id: ctx.workspaceId,
  }));
  const totalCents = built.data.totalCents;

  // -- Clear invoiced_at on removed time entries (after validation)
  if (removedTimeEntryIds.length > 0) {
    await supabase
      .from('time_entries')
      .update({ invoiced_at: null })
      .in('id', removedTimeEntryIds)
      .eq('workspace_id', ctx.workspaceId);
  }

  // -- Replace line items
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

  // -- Update invoice header
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
