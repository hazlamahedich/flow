import { Suspense } from 'react';
import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, getUserProfile, getDashboardSummary } from '@flow/db';
import { DashboardContent } from '@flow/ui';
import { DashboardSkeleton } from './dashboard-skeleton';

export default async function WorkspacePage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardPageContent />
    </Suspense>
  );
}

async function DashboardPageContent() {
  const supabase = await getServerSupabase();
  const { workspaceId, userId } = await requireTenantContext(supabase);

  const [summary, profile] = await Promise.all([
    getDashboardSummary(supabase, workspaceId),
    getUserProfile(supabase, userId),
  ]);

  return <DashboardContent summary={summary} profile={profile} />;
}
