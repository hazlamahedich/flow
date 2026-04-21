import { requireTenantContext } from '@flow/db';
import { getServerSupabase } from '@/lib/supabase-server';
import type { Metadata } from 'next';
import { SessionsList } from './components/sessions-list';

export const metadata: Metadata = {
  title: 'Active Sessions',
};

export const dynamic = 'force-dynamic';

export default async function SessionsPage() {
  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);

  if (ctx.role !== 'owner') {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-[var(--flow-color-text-primary)]">
          Active Sessions
        </h1>
        <p className="text-sm text-[var(--flow-color-text-secondary)]">
          Only workspace owners can view active sessions.
        </p>
      </div>
    );
  }

  // service_role: allowed — owner-only cross-user device visibility
  const { createServiceClient } = await import('@flow/db/client');
  const serviceClient = createServiceClient();

  const { data: members, error: membersError } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', ctx.workspaceId)
    .eq('status', 'active');

  if (membersError) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-[var(--flow-color-text-primary)]">
          Active Sessions
        </h1>
        <p className="text-sm text-red-600">
          Failed to load team data. Please try again.
        </p>
      </div>
    );
  }

  const memberUserIds = (members ?? []).map((m) => m.user_id);
  const memberUserIdsExcludingSelf = memberUserIds.filter((id) => id !== ctx.userId);
  const memberCount = memberUserIdsExcludingSelf.length;

  if (memberUserIdsExcludingSelf.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-[var(--flow-color-text-primary)]">
          Active Sessions
        </h1>
        <p className="text-sm text-[var(--flow-color-text-secondary)]">
          No other active sessions right now.{' '}
          {memberCount === 0
            ? "You don't have any other team members yet."
            : `You have ${memberCount} team member${memberCount === 1 ? '' : 's'}.`}
        </p>
      </div>
    );
  }

  const { data: devices } = await serviceClient
    .from('user_devices')
    .select('id, user_id, label, user_agent_hint, last_seen_at, is_revoked')
    .in('user_id', memberUserIdsExcludingSelf)
    .eq('is_revoked', false)
    .order('last_seen_at', { ascending: false });

  const activeDevices = (devices ?? []).map((d) => ({
    id: d.id,
    userId: d.user_id,
    label: d.label,
    userAgentHint: d.user_agent_hint ?? '',
    lastSeenAt: d.last_seen_at,
  }));

  return <SessionsList devices={activeDevices} memberCount={memberCount} />;
}
