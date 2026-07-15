import { getServerSupabase } from '@/lib/supabase-server';
import { CreateInvoiceForm } from './components/create-invoice-form';

export default async function NewInvoicePage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const workspaceId = user.app_metadata?.workspace_id as string | undefined;
  if (!workspaceId) return null;

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, hourly_rate_cents')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .order('name');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Create Invoice</h1>
      <CreateInvoiceForm
        clients={(clients ?? []).map((c: Record<string, unknown>) => ({
          id: c.id as string,
          name: c.name as string,
          hourlyRateCents: c.hourly_rate_cents as number | null,
        }))}
      />
    </div>
  );
}
