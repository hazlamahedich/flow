import { getServerSupabase } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';

export default async function WorkspacePickerPage() {
  const supabase = await getServerSupabase();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, workspaces(name)')
    .eq('user_id', session.user.id)
    .is('removed_at', null);

  if (!memberships || memberships.length === 0) {
    redirect('/onboarding');
  }

  if (memberships.length === 1) {
    redirect('/');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--flow-color-bg-primary)]">
      <div className="w-full max-w-md rounded-lg border border-[var(--flow-color-border-default)] bg-[var(--flow-color-bg-secondary)] p-6">
        <h1 className="mb-4 text-xl font-semibold text-[var(--flow-color-text-primary)]">
          Choose a workspace
        </h1>
        <ul className="space-y-2">
          {memberships.map((m) => (
            <li key={m.workspace_id}>
              <a
                href={`/?workspace=${m.workspace_id}`}
                className="block rounded-md border border-[var(--flow-color-border-default)] px-4 py-3 text-sm text-[var(--flow-color-text-primary)] transition-colors hover:bg-[var(--flow-color-bg-tertiary)]"
              >
                {(m.workspaces as unknown as { name: string } | null)?.name ?? 'Untitled Workspace'}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
