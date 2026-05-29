'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, createFlowError } from '@flow/db';
import type { ActionResult } from '@flow/types';

export interface InboxItem {
  id: string;
  type: string;
  data: Record<string, unknown>;
  createdAt: string;
  dismissed: boolean;
}

export async function getInboxItems(): Promise<ActionResult<InboxItem[]>> {
  const supabase = await getServerSupabase();
  let ctx;
  try {
    ctx = await requireTenantContext(supabase);
  } catch {
    return {
      success: false,
      error: createFlowError(401, 'AUTH_REQUIRED', 'Authentication required', 'auth'),
    };
  }

  const items: InboxItem[] = [];

  const { data: summaries } = await supabase
    .from('friday_feeling_summaries')
    .select('*')
    .eq('workspace_id', ctx.workspaceId)
    .is('dismissed_at', null)
    .order('generated_at', { ascending: false })
    .limit(50);

  for (const s of summaries ?? []) {
    items.push({
      id: s.id,
      type: 'friday_feeling',
      data: s as Record<string, unknown>,
      createdAt: s.generated_at,
      dismissed: false,
    });
  }

  return { success: true, data: items };
}
