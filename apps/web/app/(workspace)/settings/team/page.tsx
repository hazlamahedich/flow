import { requireTenantContext } from '@flow/db';
import { getServerSupabase } from '@/lib/supabase-server';
import type { Metadata } from 'next';
import { TeamMemberList } from './components/team-member-list';
import { InviteForm } from './components/invite-form';
import { PendingInvitationsList } from './components/pending-invitations-list';

export const metadata: Metadata = {
  title: 'Team Management',
};

export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  const { data: { user } } = await supabase.auth.getUser();
  const currentUserEmail = user?.email ?? '';

  const { data: members, error: membersError } = await supabase
    .from('workspace_members')
    .select('id, user_id, role, status, joined_at, expires_at, users(name, email)')
    .eq('workspace_id', ctx.workspaceId)
    .eq('status', 'active')
    .order('joined_at', { ascending: true });

  const { data: invitations, error: invitationsError } = await supabase
    .from('workspace_invitations')
    .select('id, email, role, expires_at, created_at, accepted_at')
    .eq('workspace_id', ctx.workspaceId)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  const { data: workspace, error: workspaceError } = await supabase
    .from('workspaces')
    .select('name')
    .eq('id', ctx.workspaceId)
    .single();

  if (membersError || invitationsError || workspaceError) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-[var(--flow-color-text-primary)]">
          Team
        </h1>
        <p className="text-sm text-red-600">
          Failed to load team data. Please try again.
        </p>
      </div>
    );
  }

  const activeMembers = (members ?? []).map((m) => ({
    id: m.id,
    userId: m.user_id,
    role: m.role,
    status: m.status,
    joinedAt: m.joined_at,
    expiresAt: m.expires_at,
    name: (m.users as unknown as { name: string | null } | null)?.name ?? 'Unknown',
    email: (m.users as unknown as { email: string | null } | null)?.email ?? '',
  }));

  const pendingInvitations = (invitations ?? []).map((inv) => ({
    id: inv.id,
    email: inv.email,
    role: inv.role,
    expiresAt: inv.expires_at,
    createdAt: inv.created_at,
  }));

  const workspaceName = workspace?.name ?? 'Your Workspace';

  if (ctx.role === 'member') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-[var(--flow-color-text-primary)]">
          Your Workspace
        </h1>
        <div className="rounded-lg border border-[var(--flow-color-border-default)] p-6">
          <p className="text-lg font-medium text-[var(--flow-color-text-primary)]">
            {workspaceName}
          </p>
          <p className="mt-1 text-sm text-[var(--flow-color-text-secondary)]">
            Your role: <span className="capitalize">{ctx.role}</span>
          </p>
        </div>
        <a
          href="/settings/clients"
          className="text-sm text-[var(--flow-color-text-secondary)] underline hover:text-[var(--flow-color-text-primary)]"
        >
          View your client access
        </a>
      </div>
    );
  }

  const canInvite = ctx.role === 'owner' || ctx.role === 'admin';
  const canManageRoles = ctx.role === 'owner';
  const canScopeClients = ctx.role === 'owner' || ctx.role === 'admin';
  const canTransfer = ctx.role === 'owner';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[var(--flow-color-text-primary)]">
          Team
        </h1>
        {canInvite && <InviteForm actorRole={ctx.role} currentEmail={currentUserEmail} />}
      </div>

      {activeMembers.length === 1 && (
        <div className="rounded-lg border border-[var(--flow-color-border-default)] p-6 text-center">
          <p className="text-[var(--flow-color-text-secondary)]">
            {workspaceName} — it&apos;s just you right now!
          </p>
        </div>
      )}

      {activeMembers.length > 1 && (
        <TeamMemberList
          members={activeMembers}
          actorRole={ctx.role}
          canManageRoles={canManageRoles}
          canRevoke={ctx.role === 'owner'}
          canScopeClients={canScopeClients}
          canTransfer={canTransfer}
          workspaceId={ctx.workspaceId}
          workspaceName={workspaceName}
        />
      )}

      {pendingInvitations.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-medium text-[var(--flow-color-text-primary)]">
            Pending Invitations
          </h2>
          <PendingInvitationsList invitations={pendingInvitations} />
        </div>
      )}

      {pendingInvitations.length === 0 && canInvite && (
        <p className="text-sm text-[var(--flow-color-text-secondary)]">
          No pending invitations.
        </p>
      )}
    </div>
  );
}
