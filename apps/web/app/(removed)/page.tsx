import { getServerSupabase } from '@/lib/supabase-server';
import Link from 'next/link';

export default async function RemovedPage() {
  const supabase = await getServerSupabase();
  const { data: { session } } = await supabase.auth.getSession();

  let otherWorkspaces: Array<{ id: string; name: string }> = [];
  if (session?.user) {
    const { data: memberships } = await supabase
      .from('workspace_members')
      .select('workspace_id, workspaces(name)')
      .eq('user_id', session.user.id)
      .eq('status', 'active');

    if (memberships && memberships.length > 0) {
      otherWorkspaces = memberships.map((m) => ({
        id: m.workspace_id,
        name: (m.workspaces as unknown as { name: string })?.name ?? 'Workspace',
      }));
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--flow-color-bg-primary)]">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-[var(--flow-color-text-primary)]">
          Removed from Workspace
        </h1>
        <p className="mt-2 text-sm text-[var(--flow-color-text-secondary)]">
          You have been removed from the workspace. If you believe this is an error, contact your workspace owner.
        </p>
        {otherWorkspaces.length > 0 && (
          <div className="mt-6">
            <p className="text-sm text-[var(--flow-color-text-secondary)]">
              Sign in to another workspace:
            </p>
            <ul className="mt-2 space-y-1">
              {otherWorkspaces.map((ws) => (
                <li key={ws.id}>
                  <Link
                    href={`/workspace-picker`}
                    className="text-sm text-[var(--flow-color-text-accent)] underline"
                  >
                    {ws.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        <Link
          href="/login"
          className="mt-4 inline-block text-sm text-[var(--flow-color-text-accent)] underline"
        >
          Contact support
        </Link>
      </div>
    </div>
  );
}
