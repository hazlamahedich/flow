import { LogoutButton } from './logout-button';
import { getServerSupabase } from '@/lib/supabase-server';
import { redirect } from 'next/navigation';

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await getServerSupabase();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-[var(--flow-color-bg-primary)]">
      <div className="flex items-center justify-end border-b border-[var(--flow-color-border-default)] px-4 py-2 gap-3">
        <span className="text-sm text-[var(--flow-color-text-secondary)]">
          {session.user.email}
        </span>
        <LogoutButton />
      </div>
      {children}
    </div>
  );
}
