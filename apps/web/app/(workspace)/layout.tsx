import { WorkspaceShell } from '@flow/ui';
import { getServerSupabase } from '@/lib/supabase-server';
import { listUserWorkspaces } from '@flow/db';
import { switchWorkspace } from './actions/switch-workspace';
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
  const workspaceId = session.user.app_metadata.workspace_id as string | undefined;

  try {
    if (typeof workspaceId === 'string' && workspaceId.length > 0) {
      const { count } = await supabase
        .from('agent_configurations')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('is_active', true);
      agentCount = count ?? 0;
    }
  } catch {
    agentCount = 1;
  }

  if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DEV_AGENT_COUNT) {
    const parsed = Number(process.env.NEXT_PUBLIC_DEV_AGENT_COUNT);
    if (Number.isFinite(parsed)) {
      agentCount = parsed;
    }
  }

  let workspaces: Array<{ id: string; name: string; role: string }> = [];
  try {
    if (session.user.id) {
      workspaces = await listUserWorkspaces(supabase, session.user.id);
    }
  } catch {
    workspaces = [];
  }

  return (
    <WorkspaceShell
      agentCount={agentCount}
      workspaces={workspaces}
      activeWorkspaceId={workspaceId ?? ''}
      onSwitchWorkspace={switchWorkspace}
    >
      {children}
    </WorkspaceShell>
  );
}
