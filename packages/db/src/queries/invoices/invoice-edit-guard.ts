import type { SupabaseClient } from '@supabase/supabase-js';

export interface InvoiceEditGuard {
  isInvoiced(entryId: string): Promise<boolean>;
}

export function createInvoiceEditGuard(client: SupabaseClient): InvoiceEditGuard {
  return {
    async isInvoiced(entryId: string): Promise<boolean> {
      const { data, error } = await client
        .from('invoice_line_items')
        .select('id, invoices(status)')
        .eq('time_entry_id', entryId)
        .limit(1);

      if (error) throw new Error(`InvoiceEditGuard query failed: ${error.message}`);
      if (!data || data.length === 0) return false;

      const row = data[0] as Record<string, unknown>;
      const invoice = row.invoices as Record<string, unknown> | null;
      return invoice !== null && invoice.status !== 'voided';
    },
  };
}
