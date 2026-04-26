import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext } from '@flow/db';
import { getTrustEvents } from '@flow/db';
import type { Metadata } from 'next';
import { HistoryFilters } from './components/history-filters';
import { HistoryTable } from './components/history-table';

export const metadata: Metadata = { title: 'Trust History' };
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TrustHistoryPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await getServerSupabase();
  const { workspaceId } = await requireTenantContext(supabase);

  const page = typeof params.page === 'string' ? parseInt(params.page, 10) : 1;
  const agentId = typeof params.agent === 'string' ? params.agent : undefined;
  const direction = typeof params.direction === 'string'
    ? params.direction as 'upgrade' | 'regression' | 'all' | undefined
    : undefined;
  const dateFrom = typeof params.from === 'string' ? params.from : undefined;
  const dateTo = typeof params.to === 'string' ? params.to : undefined;

  const events = await getTrustEvents(workspaceId, {
    agentId,
    direction: direction ?? 'all',
    dateFrom,
    dateTo,
    page: Math.max(1, page),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[var(--flow-color-text-primary)]">
          Trust History
        </h1>
      </div>
      <HistoryFilters
        currentAgent={agentId}
        currentDirection={direction}
        currentDateFrom={dateFrom}
        currentDateTo={dateTo}
      />
      <HistoryTable
        events={events.data}
        total={events.total}
        page={events.page}
        pageSize={events.pageSize}
      />
    </div>
  );
}
