import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, getUserProfile, getDashboardSummary } from '@flow/db';
import { DashboardContent } from '@flow/ui';
import { WelcomeCard } from './_components/welcome-card';
import { DayTwoInput } from './_components/day-two-input';

export default async function WorkspacePage() {
  const supabase = await getServerSupabase();
  const { workspaceId, userId } = await requireTenantContext(supabase);

  const [summary, profile, userData] = await Promise.all([
    getDashboardSummary(supabase, workspaceId),
    getUserProfile(supabase, userId),
    supabase
      .from('users')
      .select('completed_onboarding, created_at')
      .eq('id', userId)
      .single(),
  ]);

  const completedOnboarding = userData.data?.completed_onboarding === true;
  const isDayOne =
    completedOnboarding &&
    userData.data?.created_at &&
    new Date(userData.data.created_at).toDateString() === new Date().toDateString();

  return (
    <>
      {completedOnboarding && (
        isDayOne ? (
          <WelcomeCard name={profile?.name ?? null} />
        ) : (
          <DayTwoInput />
        )
      )}
      <DashboardContent summary={summary} profile={profile} />
    </>
  );
}
