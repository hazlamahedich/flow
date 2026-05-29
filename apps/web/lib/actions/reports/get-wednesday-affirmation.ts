'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, createFlowError, getActiveWednesdayAffirmation } from '@flow/db';
import type { ActionResult } from '@flow/types';

export interface WednesdayAffirmationData {
  id: string;
  teamMemberId: string;
  story: string;
  milestone: Record<string, unknown>;
  generatedAt: string;
  dismissedAt: string | null;
}

export async function getWednesdayAffirmationAction(): Promise<ActionResult<WednesdayAffirmationData>> {
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

  if (ctx.role !== 'owner') {
    return {
      success: false,
      error: createFlowError(403, 'FORBIDDEN', 'Only owners can view Wednesday affirmations.', 'auth'),
    };
  }

  const row = await getActiveWednesdayAffirmation(supabase, ctx.workspaceId);
  if (!row) {
    return {
      success: true,
      data: null as unknown as WednesdayAffirmationData,
    };
  }

  return {
    success: true,
    data: {
      id: row.id,
      teamMemberId: row.team_member_id,
      story: row.story,
      milestone: row.milestone,
      generatedAt: row.generated_at,
      dismissedAt: row.dismissed_at,
    },
  };
}
