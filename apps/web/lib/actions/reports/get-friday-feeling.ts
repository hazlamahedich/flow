'use server';

import { getServerSupabase } from '@/lib/supabase-server';
import { requireTenantContext, createFlowError, getActiveFridayFeeling } from '@flow/db';
import type { ActionResult } from '@flow/types';

export interface FridayFeelingData {
  id: string;
  weekStart: string;
  weekEnd: string;
  headline: string;
  tasksHandled: number;
  timeSavedMinutes: number;
  trustMilestones: unknown[];
  generatedAt: string;
  dismissedAt: string | null;
}

export async function getFridayFeelingAction(): Promise<ActionResult<FridayFeelingData | null>> {
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

  const row = await getActiveFridayFeeling(supabase, ctx.workspaceId);
  if (!row) {
    return { success: true, data: null };
  }

  return {
    success: true,
    data: {
      id: row.id,
      weekStart: row.week_start,
      weekEnd: row.week_end,
      headline: row.headline,
      tasksHandled: row.tasks_handled,
      timeSavedMinutes: row.time_saved_minutes,
      trustMilestones: row.trust_milestones as unknown[],
      generatedAt: row.generated_at,
      dismissedAt: row.dismissed_at,
    },
  };
}
