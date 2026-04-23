'use server';

import { createAdminSupabase } from '@flow/db';
import { getServerSupabase } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';

export async function switchWorkspace(workspaceId: string): Promise<void> {
  const supabase = await getServerSupabase();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('Authentication required');
  }

  const { data: membership, error: membershipError } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (membershipError || !membership) {
    throw new Error('You are not a member of this workspace');
  }

  const adminClient = createAdminSupabase();
  const { data: existingUser, error: fetchErr } = await adminClient.auth.admin.getUserById(user.id);
  if (fetchErr || !existingUser?.user) {
    throw new Error('Failed to verify user for workspace switch');
  }

  const { error: updateErr } = await adminClient.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...existingUser.user.app_metadata,
      workspace_id: workspaceId,
    },
  });

  if (updateErr) {
    throw new Error(`Failed to update workspace: ${updateErr.message}`);
  }

  await supabase.auth.refreshSession();

  revalidatePath('/', 'layout');

  return;
}
