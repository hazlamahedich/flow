import { WorkspaceShellClient } from './workspace-shell-client';
import { getServerSupabase } from '@/lib/supabase-server';
import { listUserWorkspaces, getActiveAgentCount } from '@flow/db';
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

  let agentCount = 0;
  const workspaceId = session.user.app_metadata.workspace_id as string | undefined;

  if (typeof workspaceId === 'string' && workspaceId.length > 0) {
    try {
      agentCount = await getActiveAgentCount(workspaceId);
    } catch {
      agentCount = 0;
    }
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
    <WorkspaceShellClient
      agentCount={agentCount}
      workspaces={workspaces}
      activeWorkspaceId={workspaceId ?? ''}
      onSwitchWorkspace={switchWorkspace}
    >
      {children}
    </WorkspaceShellClient>
  );
}
