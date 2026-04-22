import { WorkspaceShell } from '@flow/ui';
import { LogoutButton } from './logout-button';
import { getServerSupabase } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';

export default async function WorkspaceLayout({
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

  let agentCount = 1;
  try {
    const { count } = await supabase
      .from('agent_configurations')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', session.user.app_metadata.workspace_id as string)
      .eq('is_active', true);
    agentCount = count ?? 0;
  } catch {
    agentCount = 1;
  }

  if (process.env.NEXT_PUBLIC_DEV_AGENT_COUNT) {
    agentCount = Number(process.env.NEXT_PUBLIC_DEV_AGENT_COUNT);
  }

  return <WorkspaceShell agentCount={agentCount}>{children}</WorkspaceShell>;
}
