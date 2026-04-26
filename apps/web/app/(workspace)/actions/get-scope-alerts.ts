'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, getScopeCreepAlerts } from '@flow/db';
import type { ScopeCreepAlert } from '@flow/types';

export async function getScopeAlerts(): Promise<ScopeCreepAlert[]> {
  const supabase = await getServerSupabase();
  const ctx = await requireTenantContext(supabase);
  return getScopeCreepAlerts(supabase, { workspaceId: ctx.workspaceId });
}
