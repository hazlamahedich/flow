import { getClientById } from '@flow/db';
import { getServerSupabase } from '@/lib/supabase-server';
import { notFound } from 'next/navigation';
import { ClientHeader } from './components/client-header';
import { ClientDetails } from './components/client-details';
import type { Client } from '@flow/types';

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const supabase = await getServerSupabase();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return notFound();

  const workspaceId = user.app_metadata?.workspace_id as string | undefined;
  const role = user.app_metadata?.role as string | undefined;
  if (!workspaceId || !role) return notFound();

  const client = await getClientById(supabase, { clientId, workspaceId });
  if (!client) return notFound();

  return (
    <div className="space-y-6">
      <ClientHeader client={client as Client} role={role} />
      <ClientDetails client={client as Client} role={role} />
    </div>
  );
}
