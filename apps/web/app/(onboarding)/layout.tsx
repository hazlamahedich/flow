import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase-server';

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await getServerSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  const { data: userData } = await supabase
    .from('users')
    .select('completed_onboarding')
    .eq('id', session.user.id)
    .single();

  if (userData?.completed_onboarding === true) {
    redirect('/');
  }

  return <>{children}</>;
}
