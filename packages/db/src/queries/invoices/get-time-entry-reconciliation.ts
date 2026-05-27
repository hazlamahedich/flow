import type { SupabaseClient } from '@supabase/supabase-js';

export interface TimeEntryReconciliationRow {
  timeEntryId: string;
  date: string;
  durationMinutes: number;
  description: string;
  invoicedAmountCents: number;
  invoiceNumber: string;
  invoiceStatus: string;
  invoiceId: string;
}

export async function getTimeEntryReconciliation(
  client: SupabaseClient,
  clientId: string,
  workspaceId: string,
): Promise<TimeEntryReconciliationRow[]> {
  const { data, error } = await client
    .from('invoice_line_items')
    .select(
      'time_entry_id, amount_cents, invoices!inner(id, invoice_number, status, workspace_id), time_entries!inner(id, date, duration_minutes, notes, client_id, workspace_id)',
    )
    .eq('source_type', 'time_entry')
    .eq('invoices.workspace_id', workspaceId)
    .eq('time_entries.client_id', clientId)
    .eq('time_entries.workspace_id', workspaceId)
    .not('time_entry_id', 'is', null);

  if (error) throw error;

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const seen = new Map<string, TimeEntryReconciliationRow>();

  for (const row of rows) {
    const te = row.time_entries as Record<string, unknown> | null;
    const inv = row.invoices as Record<string, unknown> | null;
    if (!te || !inv) continue;

    const teId = String(te.id ?? '');
    const invoiceId = String(inv.id ?? '');
    const invoiceStatus = String(inv.status ?? '');

    const existing = seen.get(teId);
    if (existing) {
      if (invoiceStatus !== 'voided' && existing.invoiceStatus === 'voided') {
        seen.set(teId, {
          ...existing,
          invoicedAmountCents: Number(row.amount_cents ?? 0),
          invoiceNumber: String(inv.invoice_number ?? ''),
          invoiceStatus,
          invoiceId,
        });
      }
    } else {
      seen.set(teId, {
        timeEntryId: teId,
        date: String(te.date ?? ''),
        durationMinutes: Number(te.duration_minutes ?? 0),
        description: String(te.notes ?? ''),
        invoicedAmountCents: Number(row.amount_cents ?? 0),
        invoiceNumber: String(inv.invoice_number ?? ''),
        invoiceStatus,
        invoiceId,
      });
    }
  }

  return Array.from(seen.values());
}
