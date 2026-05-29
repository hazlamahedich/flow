import Link from 'next/link';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext } from '@flow/db';
import { ClientTemplatePage } from './components/ClientTemplatePage';

async function getClientsForWorkspace(workspaceId: string) {
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from('clients')
    .select('id, name')
    .eq('workspace_id', workspaceId)
    .is('archived', false)
    .order('name', { ascending: true });
  return (data ?? []).map((c) => ({ id: c.id, name: c.name }));
}

async function getTemplatesForWorkspace(workspaceId: string) {
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from('report_templates')
    .select('id, client_id, name, sections_config, branding, updated_at')
    .eq('workspace_id', workspaceId)
    .order('updated_at', { ascending: false });
  return (data ?? []).map((row) => ({
    id: row.id as string,
    clientId: ((row.client_id as string | null) ?? null) && typeof row.client_id === 'string' ? (row.client_id as string) : null,
    name: row.name as string,
    sectionsConfig: (row.sections_config as Record<string, unknown>) ?? {},
    branding: (row.branding as Record<string, unknown>) ?? {},
    updatedAt: String(row.updated_at),
  }));
}

export default async function TemplatesPage() {
  const supabase = await getServerSupabase();
  let ctx;
  try {
    ctx = await requireTenantContext(supabase);
  } catch {
    return (
      <div className="space-y-6">
        <Link href="/reports" className="text-sm text-muted-foreground hover:underline">
          ← Back to reports
        </Link>
        <p className="text-sm text-destructive">Authentication required</p>
      </div>
    );
  }

  const [items, clients] = await Promise.all([
    getTemplatesForWorkspace(ctx.workspaceId),
    getClientsForWorkspace(ctx.workspaceId),
  ]);

  return (
    <div className="space-y-6">
      <Link href="/reports" className="text-sm text-muted-foreground hover:underline">
        ← Back to reports
      </Link>
      <ClientTemplatePage items={items} clients={clients} />
    </div>
  );
}
