'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { logAuthEvent } from '@/lib/auth-audit';
import { getServerSupabase } from '@/lib/supabase-server';

export async function logout(): Promise<void> {
  const supabase = await getServerSupabase();
  const headerStore = await headers();

  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    const ip = headerStore.get('x-forwarded-for') ?? headerStore.get('x-real-ip') ?? 'unknown';
    const logParams: Parameters<typeof logAuthEvent>[0] = {
      action: 'session_revoked',
      userId: session.user.id,
      ip,
      outcome: 'success',
    };
    if (session.user.email) {
      logParams.email = session.user.email;
    }
    await logAuthEvent(logParams);

    await supabase.auth.signOut();
  }

  redirect('/login?message=signed_out');
}
