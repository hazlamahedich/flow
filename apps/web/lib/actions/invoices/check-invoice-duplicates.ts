'use server';

import { z } from 'zod';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, createFlowError } from '@flow/db';
import type { ActionResult, DuplicateWarning } from '@flow/types';

const checkDuplicatesInputSchema = z.object({
  clientId: z.string().uuid(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lineItems: z.array(z.object({
    sourceType: z.string(),
    timeEntryId: z.string().optional(),
    retainerId: z.string().optional(),
    description: z.string().optional(),
    amountCents: z.number().optional(),
  })),
});

export async function checkInvoiceDuplicatesAction(
  input: unknown,
): Promise<ActionResult<DuplicateWarning[]>> {
  const parsed = checkDuplicatesInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createFlowError(400, 'VALIDATION_ERROR', parsed.error.message, 'validation'),
    };
  }

  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  const { clientId, issueDate, lineItems } = parsed.data;

  const dayMs = 1000 * 60 * 60 * 24;
  const issueDateMs = new Date(`${issueDate}T00:00:00Z`).getTime();
  const sevenDaysBefore = new Date(issueDateMs - 7 * dayMs).toISOString().split('T')[0];
  const sevenDaysAfter = new Date(issueDateMs + 7 * dayMs).toISOString().split('T')[0];

  const { data: nearbyInvoices } = await supabase
    .from('invoices')
    .select('id, invoice_number')
    .eq('client_id', clientId)
    .eq('workspace_id', ctx.workspaceId)
    .neq('status', 'voided')
    .gte('issue_date', sevenDaysBefore)
    .lte('issue_date', sevenDaysAfter);

  if (!nearbyInvoices || nearbyInvoices.length === 0) {
    return { success: true, data: [] };
  }

  const teIds = lineItems
    .filter((li) => li.sourceType === 'time_entry' && li.timeEntryId)
    .map((li) => li.timeEntryId!);
  const retIds = lineItems
    .filter((li) => li.sourceType === 'retainer' && li.retainerId)
    .map((li) => li.retainerId!);

  const nearbyIds = nearbyInvoices.map((inv: Record<string, unknown>) => inv.id as string);

  const { data: allItems } = await supabase
    .from('invoice_line_items')
    .select('invoice_id, source_type, time_entry_id, retainer_id')
    .in('invoice_id', nearbyIds);

  if (!allItems) return { success: true, data: [] };

  const warningSet = new Map<string, DuplicateWarning>();

  for (const item of allItems as Array<Record<string, unknown>>) {
    const invId = item.invoice_id as string;
    const inv = nearbyInvoices.find((i: Record<string, unknown>) => i.id === invId) as Record<string, unknown> | undefined;
    if (!inv) continue;

    let matchedId: string | null = null;
    if (item.source_type === 'time_entry' && item.time_entry_id && teIds.includes(item.time_entry_id as string)) {
      matchedId = item.time_entry_id as string;
    } else if (item.source_type === 'retainer' && item.retainer_id && retIds.includes(item.retainer_id as string)) {
      matchedId = item.retainer_id as string;
    }

    if (matchedId) {
      const existing = warningSet.get(invId);
      if (existing) {
        existing.matchingSourceIds!.push(matchedId);
      } else {
        warningSet.set(invId, {
          invoiceId: invId,
          invoiceNumber: inv.invoice_number as string,
          reason: 'soft',
          matchingSourceIds: [matchedId],
        });
      }
    }
  }

  return { success: true, data: Array.from(warningSet.values()) };
}
