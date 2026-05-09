import { listTimeEntries, listAllActiveClients } from '@flow/db';
import { getServerSupabase } from '@/lib/supabase-server';
import { listWorkspaceMembersAction } from './actions/list-workspace-members';
import { TimeEntryList } from './components/time-entry-list';

export default async function TimePage() {
  const supabase = await getServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const workspaceId = user.app_metadata?.workspace_id as string | undefined;
  const role = user.app_metadata?.role as string | undefined;
  const userId = user.id;
  if (!workspaceId || !role) return null;

  let entriesResult: Awaited<ReturnType<typeof listTimeEntries>>;
  let clients: Awaited<ReturnType<typeof listAllActiveClients>>;
  let membersResult: Awaited<ReturnType<typeof listWorkspaceMembersAction>>;

  try {
    [entriesResult, clients, membersResult] = await Promise.all([
      listTimeEntries(supabase, {
        workspaceId,
        userId,
        role,
        filters: {},
        page: 1,
        pageSize: 25,
      }),
      listAllActiveClients(supabase, workspaceId),
      listWorkspaceMembersAction(),
    ]);
  } catch {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Failed to load time entries. Please refresh.</p>
      </div>
    );
  }

  const members = membersResult.success ? membersResult.data : [];

  return (
    <TimeEntryList
      initialEntries={entriesResult.items}
      initialTotal={entriesResult.total}
      initialPage={entriesResult.page}
      initialHasNextPage={entriesResult.hasNextPage}
      clients={clients}
      members={members}
      workspaceId={workspaceId}
      userId={userId}
      role={role}
    />
  );
}
