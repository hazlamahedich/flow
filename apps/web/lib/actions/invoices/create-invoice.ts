'use server';

import { revalidateTag } from 'next/cache';
import { getServerSupabase } from '@/lib/supabase-server';
import {
  requireTenantContext,
  createFlowError,
  cacheTag,
} from '@flow/db';
import { createInvoiceSchema } from '@flow/types';
import type { ActionResult, Invoice } from '@flow/types';
import { computeInvoiceDedupHash } from '@flow/shared';
import { checkDuplicateTimeEntries } from './create-invoice-helpers';
import { resolveTimeEntryDurations } from './resolve-time-entries';
import { buildLineItemsAndTotal } from './build-invoice-line-items';
import { mapCreatedInvoice } from './create-invoice-mapper';

export async function createInvoiceAction(
  input: unknown,
): Promise<ActionResult<Invoice>> {
  const parsed = createInvoiceSchema.safeParse(input);
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

  const { clientId, lineItems, issueDate, dueDate, notes } = parsed.data;

  // -- Validate client
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, status')
    .eq('id', clientId)
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();

  if (clientError || !client) {
    return {
      success: false,
      error: createFlowError(404, 'CLIENT_NOT_FOUND', 'Client not found.', 'validation'),
    };
  }

  if ((client as Record<string, unknown>).status === 'archived') {
    return {
      success: false,
      error: createFlowError(400, 'CLIENT_ARCHIVED', 'Cannot create invoice for archived client.', 'validation'),
    };
  }

  // -- Retainer duplicate check (±1 day window)
  const dayMs = 1000 * 60 * 60 * 24;
  const issueDateMs = new Date(`${issueDate}T00:00:00Z`).getTime();
  const oneDayBefore = new Date(issueDateMs - dayMs).toISOString().split('T')[0];
  const oneDayAfter = new Date(issueDateMs + dayMs).toISOString().split('T')[0];

  const { data: duplicates } = await supabase
    .from('invoices')
    .select('id')
    .eq('client_id', clientId)
    .eq('workspace_id', ctx.workspaceId)
    .neq('status', 'voided')
    .gte('issue_date', oneDayBefore)
    .lte('issue_date', oneDayAfter);

  if (duplicates && duplicates.length > 0) {
    const retSources = lineItems
      .filter((li) => li.sourceType === 'retainer')
      .map((li) => li.retainerId)
      .filter(Boolean)
      .sort();

    if (retSources.length > 0) {
      const dupIds = duplicates.map((d: Record<string, unknown>) => d.id as string);
      const { data: allDupItems } = await supabase
        .from('invoice_line_items')
        .select('invoice_id, source_type, retainer_id')
        .in('invoice_id', dupIds);

      if (allDupItems) {
        const grouped = new Map<string, string[]>();
        for (const di of allDupItems as Array<Record<string, unknown>>) {
          const invId = di.invoice_id as string;
          if (di.source_type === 'retainer' && di.retainer_id) {
            const existing = grouped.get(invId) ?? [];
            existing.push(di.retainer_id as string);
            grouped.set(invId, existing.sort());
          }
        }
        for (const [, dupRetIds] of grouped) {
          if (retSources.join(',') === dupRetIds.join(',')) {
            return {
              success: false,
              error: createFlowError(409, 'DUPLICATE_INVOICE', 'A duplicate invoice exists with the same line items for this client.', 'financial'),
            };
          }
        }
      }
    }
  }

  // -- Generate invoice number
  const { data: invNumResult, error: invNumError } = await supabase
    .rpc('generate_invoice_number', { p_workspace_id: ctx.workspaceId });

  if (invNumError || !invNumResult) {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to generate invoice number.', 'system'),
    };
  }

  const invoiceNumber = invNumResult as string;

  // -- Resolve time entries
  const timeEntryIds = lineItems
    .filter((li) => li.sourceType === 'time_entry')
    .map((li) => li.timeEntryId);

  let timeEntriesMap = new Map<string, { durationMinutes: number }>();
  if (timeEntryIds.length > 0) {
    const resolved = await resolveTimeEntryDurations(supabase, ctx.workspaceId, clientId, timeEntryIds);
    if (!resolved.success) return resolved;
    timeEntriesMap = resolved.data;
  }

  // -- Check for duplicate time entries on other invoices
  const dupCheck = await checkDuplicateTimeEntries(supabase, ctx.workspaceId, clientId, timeEntryIds);
  if (dupCheck) return dupCheck;

  // -- Resolve hourly rate
  const { data: rateResult } = await supabase
    .rpc('resolve_hourly_rate', { p_client_id: clientId, p_workspace_id: ctx.workspaceId });
  const hourlyRateCents = rateResult ? Number(rateResult) : null;

  // -- Build line items
  const built = buildLineItemsAndTotal(lineItems, timeEntriesMap, hourlyRateCents);
  if (!built.success) return built;
  const { dbLineItems, totalCents } = built.data;

  // -- Duplicate invoice guard (forever dedup by workspace + client + items + issue date)
  const dedupHash = computeInvoiceDedupHash({
    workspaceId: ctx.workspaceId,
    clientId,
    lineItems: dbLineItems.map((li) => ({
      sourceType: li.source_type,
      timeEntryId: li.time_entry_id ?? null,
      retainerId: li.retainer_id ?? null,
      description: li.description,
      amountCents: li.amount_cents,
      quantity: li.quantity,
    })),
    issueDate,
  });

  const { data: duplicate } = await supabase
    .from('invoices')
    .select('id')
    .eq('dedup_hash', dedupHash)
    .maybeSingle();

  if (duplicate) {
    return {
      success: false,
      error: createFlowError(409, 'DUPLICATE_INVOICE', 'A duplicate invoice exists with the same line items for this client.', 'financial'),
    };
  }

  // -- Persist invoice via atomic RPC
  try {
    const { data: invoiceId, error: rpcError } = await supabase
      .rpc('create_invoice_with_items', {
        p_workspace_id: ctx.workspaceId,
        p_client_id: clientId,
        p_invoice_number: invoiceNumber,
        p_issue_date: issueDate,
        p_due_date: dueDate,
        p_total_cents: totalCents,
        p_notes: notes ?? null,
        p_created_by: ctx.userId,
        p_items: dbLineItems,
      });

    if (rpcError || !invoiceId) {
      // Postgres unique_violation on dedup_hash (rare — the SELECT-then-INSERT
      // race window above). Per AC7, return 409 DUPLICATE_INVOICE on collision.
      if (rpcError && (rpcError as { code?: string }).code === '23505') {
        return {
          success: false,
          error: createFlowError(409, 'DUPLICATE_INVOICE', 'A duplicate invoice exists with the same line items for this client.', 'financial'),
        };
      }
      return {
        success: false,
        error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to create invoice.', 'system'),
      };
    }

    // Attach dedup hash to the created invoice (best-effort; unique index guards us)
    const { error: hashError } = await supabase
      .from('invoices')
      .update({ dedup_hash: dedupHash })
      .eq('id', invoiceId);
    if (hashError && (hashError as { code?: string }).code === '23505') {
      // Lost the race between SELECT and INSERT — another request created the
      // same invoice first. Roll back this invoice to honor dedup semantics.
      await supabase.from('invoices').delete().eq('id', invoiceId);
      return {
        success: false,
        error: createFlowError(409, 'DUPLICATE_INVOICE', 'A duplicate invoice exists with the same line items for this client.', 'financial'),
      };
    }

    revalidateTag(cacheTag('invoice', ctx.workspaceId));
    revalidateTag(cacheTag('dashboard', ctx.workspaceId));

    // -- Audit log
    await supabase.from('audit_log').insert({
      workspace_id: ctx.workspaceId,
      user_id: ctx.userId,
      action: 'create',
      entity_type: 'invoice',
      entity_id: invoiceId,
      details: { invoiceNumber, clientId, totalCents, lineItemCount: dbLineItems.length },
    });

    // -- Map response
    const mapped = await mapCreatedInvoice(supabase, invoiceId, clientId, invoiceNumber, issueDate, dueDate, totalCents, notes, ctx.workspaceId);
    return mapped;
  } catch (err) {
    // Defensive: catch any unexpected unique-violation thrown through the
    // Supabase error path as a JS exception (some clients do this).
    const code = (err as { code?: string } | null)?.code;
    if (code === '23505') {
      return {
        success: false,
        error: createFlowError(409, 'DUPLICATE_INVOICE', 'A duplicate invoice exists with the same line items for this client.', 'financial'),
      };
    }
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to create invoice.', 'system'),
    };
  }
}
