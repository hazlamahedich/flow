import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext } from '@flow/db';
import { redirect } from 'next/navigation';

export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getServerSupabase();
  try {
    const ctx = await requireTenantContext(supabase);
    if (ctx.role === 'client_user') {
      redirect('/');
    }
  } catch {
    redirect('/');
  }
  return <>{children}</>;
}
