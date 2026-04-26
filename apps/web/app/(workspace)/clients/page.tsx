import { listClients, countActiveClients } from '@flow/db';
import { getServerSupabase } from '@/lib/supabase-server';
import { clientListFiltersSchema } from '@flow/types';
import { ClientList } from './components/client-list';
import type { Client } from '@flow/types';

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const supabase = await getServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const workspaceId = user.app_metadata?.workspace_id as string | undefined;
  const role = user.app_metadata?.role as string | undefined;
  if (!workspaceId || !role) return null;

  const rawFilters = {
    status: typeof params.status === 'string' ? params.status : undefined,
    search: typeof params.search === 'string' ? params.search : undefined,
    page: typeof params.page === 'string' ? parseInt(params.page, 10) : undefined,
    sortBy: typeof params.sort === 'string' ? params.sort : undefined,
    sortOrder: typeof params.order === 'string' ? params.order : undefined,
  };

  const parsedFilters = clientListFiltersSchema.safeParse(rawFilters);
  const filters = parsedFilters.success ? parsedFilters.data : clientListFiltersSchema.parse({});

  const [result, activeCount, tierInfo] = await Promise.all([
    listClients(supabase, { workspaceId, userId: user.id, role, filters }),
    countActiveClients(supabase, workspaceId),
    (async () => {
      const { data: cfg } = await supabase.from('app_config').select('value').eq('key', 'tier_limits').single();
      const { data: ws } = await supabase.from('workspaces').select('settings').eq('id', workspaceId).single();
      const tier = (ws?.settings as Record<string, unknown> | null)?.tier as string ?? 'free';
      const limits = cfg?.value as Record<string, { maxClients?: number }> | null;
      const limit = limits?.[tier]?.maxClients ?? 5;
      return { tier, limit };
    })(),
  ]);

  return (
    <div className="space-y-6">
      <ClientList
        clients={result.items as Client[]}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        hasNextPage={result.hasNextPage}
        activeCount={activeCount}
        tierLimit={tierInfo.limit}
        tierName={tierInfo.tier}
        filters={filters}
        role={role}
      />
    </div>
  );
}
