import { getRecentActivity } from '@flow/db';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext } from '@flow/db';
import { RecentActivityFeed } from './recent-activity-feed';

interface RecentActivityWidgetProps {
  workspaceId: string;
}

export async function RecentActivityWidget({ workspaceId }: RecentActivityWidgetProps) {
  const recent = await getRecentActivity(workspaceId, 5);

  return <RecentActivityFeed entries={recent} />;
}
