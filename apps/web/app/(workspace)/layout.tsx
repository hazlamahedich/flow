import { WorkspaceShellClient } from './workspace-shell-client';
import { getServerSupabase } from '@/lib/supabase-server';
import { listUserWorkspaces, getActiveAgentCount } from '@flow/db';
import { switchWorkspace } from './actions/switch-workspace';
import { getTimerStateAction } from './time/actions/timer-actions';
import { redirect } from 'next/navigation';
import { SubscriptionStatusBanner } from './settings/billing/components/SubscriptionStatusBanner';
import { SuspendedMemberBanner } from './settings/billing/components/SuspendedMemberBanner';
import type { SubscriptionStatus } from '@flow/types';

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
  const workspaceId =
    (session.user.app_metadata?.workspace_id as string | undefined) ??
    (session.user.user_metadata?.workspace_id as string | undefined);

  if (typeof workspaceId === 'string' && workspaceId.length > 0) {
    try {
      agentCount = await getActiveAgentCount(workspaceId);
    } catch {
      agentCount = 0;
    }
  }

  if (
    process.env.NODE_ENV === 'development' &&
    process.env.NEXT_PUBLIC_DEV_AGENT_COUNT
  ) {
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
  let subscriptionStatus: SubscriptionStatus | undefined;
  if (workspaceId) {
    try {
      const { data: wsRow } = await supabase
        .from('workspaces')
        .select('subscription_status')
        .eq('id', workspaceId)
        .maybeSingle();
      const raw = (wsRow as { subscription_status?: string } | null)
        ?.subscription_status;
      if (
        raw === 'free' ||
        raw === 'active' ||
        raw === 'past_due' ||
        raw === 'cancelled' ||
        raw === 'suspended' ||
        raw === 'deleted'
      ) {
        subscriptionStatus = raw;
      }
    } catch {
      subscriptionStatus = undefined;
    }
  }

  // Story 9.5c AC5 (EC10) — if the current user's membership in the active
  // workspace is `suspended` (e.g. they were excess when the workspace
  // downgraded Agency→Pro), surface the member-suspended banner. Distinct
  // from subscriptionStatus above (FR60 workspace-suspended vs FR57a
  // member-suspended). service_role read: the member_select RLS policy gates
  // on status='active', so a suspended member cannot read their own row via
  // user JWT to discover they're suspended.
  let memberSuspendedAt: string | null = null;
  let workspaceNameForMember = '';
  if (workspaceId) {
    try {
      const { createServiceClient } = await import('@flow/db');
      const serviceClient = createServiceClient();
      const { data: memberRow } = await serviceClient
        .from('workspace_members')
        .select('status, suspended_at, workspaces(name)')
        .eq('workspace_id', workspaceId)
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (
        (memberRow as { status?: string } | null)?.status === 'suspended'
      ) {
        memberSuspendedAt =
          (memberRow as { suspended_at?: string | null } | null)
            ?.suspended_at ?? null;
        workspaceNameForMember =
          (
            memberRow as
              | { workspaces?: { name?: string } | null }
              | null
          )?.workspaces?.name ?? '';
      }
    } catch {
      memberSuspendedAt = null;
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
      {memberSuspendedAt !== null && (
        <SuspendedMemberBanner
          suspendedAt={memberSuspendedAt}
          workspaceName={workspaceNameForMember}
        />
      )}
      {children}
    </WorkspaceShellClient>
  );
}
