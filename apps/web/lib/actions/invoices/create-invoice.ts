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

  const { data: invNumResult, error: invNumError } = await supabase
    .rpc('generate_invoice_number', { p_workspace_id: ctx.workspaceId });

  if (invNumError || !invNumResult) {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to generate invoice number.', 'system'),
    };
  }

  const invoiceNumber = invNumResult as string;

  if (lineItems.some((li) => li.sourceType === 'time_entry')) {
    return {
      success: false,
      error: createFlowError(501, 'NOT_IMPLEMENTED', 'Time entry billing computation is not yet implemented. See Story 7-3a.', 'validation'),
    };
  }

  const dbLineItems = lineItems.map((item, index) => {
    if (item.sourceType === 'time_entry') {
      throw new Error('Unreachable: time_entry handled above');
    }
    if (item.sourceType === 'retainer') {
      const amount = item.amountCents;
      return {
        source_type: 'retainer',
        retainer_id: item.retainerId,
        description: item.description,
        quantity: item.quantity.toFixed(2),
        unit_price_cents: Math.round(amount / item.quantity),
        amount_cents: amount,
        sort_order: index + 1,
      };
    }
    return {
      source_type: 'fixed_service',
      description: item.description,
      quantity: item.quantity.toFixed(2),
      unit_price_cents: Math.round(item.amountCents / item.quantity),
      amount_cents: item.amountCents,
      sort_order: index + 1,
    };
  });

  const totalCents = dbLineItems.reduce((sum, li) => sum + li.amount_cents, 0);

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
      return {
        success: false,
        error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to create invoice.', 'system'),
      };
    }

    revalidateTag(cacheTag('invoice', ctx.workspaceId));
    revalidateTag(cacheTag('dashboard', ctx.workspaceId));

    const { error: auditError } = await supabase.from('audit_log').insert({
      workspace_id: ctx.workspaceId,
      user_id: ctx.userId,
      action: 'create',
      entity_type: 'invoice',
      entity_id: invoiceId,
      details: { invoiceNumber, clientId, totalCents, lineItemCount: dbLineItems.length },
    });

    if (auditError) {
      console.error('Audit log write failed for invoice create:', auditError.message);
    }

    const { data: created } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    return {
      success: true,
      data: {
        id: (created as Record<string, unknown>)?.id as string ?? invoiceId,
        workspaceId: (created as Record<string, unknown>)?.workspace_id as string ?? ctx.workspaceId,
        clientId,
        invoiceNumber,
        status: 'draft',
        issueDate,
        dueDate,
        totalCents,
        currency: ((created as Record<string, unknown>)?.currency as string) ?? 'usd',
        notes: notes ?? null,
        voidedAt: null,
        voidReason: null,
        createdAt: ((created as Record<string, unknown>)?.created_at as string) ?? new Date().toISOString(),
        updatedAt: ((created as Record<string, unknown>)?.updated_at as string) ?? new Date().toISOString(),
        amountPaidCents: 0,
        creditBalanceCents: 0,
        version: 1,
        paymentUrl: null,
        sentAt: null,
        viewedAt: null,
        deliveryToken: null,
      },
    };
  } catch {
    return {
      success: false,
      error: createFlowError(500, 'INTERNAL_ERROR', 'Failed to create invoice.', 'system'),
    };
  }
}
