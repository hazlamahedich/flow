import { WorkspaceShellClient } from './workspace-shell-client';
import { getServerSupabase } from '@/lib/supabase-server';
import { listUserWorkspaces, getActiveAgentCount } from '@flow/db';
import { switchWorkspace } from './actions/switch-workspace';
import { getTimerStateAction } from './time/actions/timer-actions';
import { redirect } from 'next/navigation';
import { SubscriptionStatusBanner } from './settings/billing/components/SubscriptionStatusBanner';

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

  let initialTimerState = null;
  try {
    const timerResult = await getTimerStateAction();
    if (timerResult.success) {
      initialTimerState = timerResult.data;
    }
  } catch {
    initialTimerState = null;
  }

  // Story 9.5b AC5a — surface the agent-pause state on every workspace page
  // when subscription_status ∈ {past_due, suspended} (FR60 P0 notify).
  // Reads via the user-scoped client (RLS) — no service_role escalation.
  let subscriptionStatus: string | undefined;
  if (workspaceId) {
    try {
      const { data: wsRow } = await supabase
        .from('workspaces')
        .select('subscription_status')
        .eq('id', workspaceId)
        .maybeSingle();
      subscriptionStatus = (wsRow as { subscription_status?: string } | null)?.subscription_status;
    } catch {
      subscriptionStatus = undefined;
    }
  }

  return (
    <WorkspaceShellClient
      agentCount={agentCount}
      workspaces={workspaces}
      activeWorkspaceId={workspaceId ?? ''}
      onSwitchWorkspace={switchWorkspace}
      initialTimerState={initialTimerState}
    >
      {subscriptionStatus && (
        <SubscriptionStatusBanner subscriptionStatus={subscriptionStatus} />
      )}
      {children}
    </WorkspaceShellClient>
  );
}
