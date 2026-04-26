import { requireTenantContext } from '@flow/db';
import { getActionHistory } from '@flow/db';
import { getServerSupabase } from '@/lib/supabase-server';
import type { Metadata } from 'next';
import { ActivityTimelineClient } from './components/activity-timeline-client';

export const metadata: Metadata = { title: 'Agent Activity' };
export const dynamic = 'force-dynamic';

interface ActivityPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ActivityPage({ searchParams }: ActivityPageProps) {
  const supabase = await getServerSupabase();
  const { workspaceId, userId } = await requireTenantContext(supabase);
  const params = await searchParams;

  const filters = {
    agentId: typeof params.agent === 'string' ? params.agent : undefined,
    status: typeof params.status === 'string' ? params.status as 'completed' | 'failed' | 'timed_out' | undefined : undefined,
    dateFrom: typeof params.dateFrom === 'string' ? params.dateFrom : undefined,
    dateTo: typeof params.dateTo === 'string' ? params.dateTo : undefined,
    clientId: typeof params.client === 'string' ? params.client : undefined,
    page: typeof params.page === 'string' ? Number(params.page) : 1,
  };

  const history = await getActionHistory(workspaceId, userId, filters);

  return (
    <div className="space-y-4">
      <nav className="text-sm text-[var(--flow-color-text-secondary)]">
        <a href="/agents" className="hover:underline">Dashboard</a>
        <span className="mx-1">&gt;</span>
        <span className="text-[var(--flow-color-text-primary)]">Activity</span>
      </nav>
      <ActivityTimelineClient
        initialData={history.data}
        totalCount={history.total}
        filters={filters}
        workspaceId={workspaceId}
        userId={userId}
      />
    </div>
  );
}
