import type { SupabaseClient } from '@supabase/supabase-js';

export interface FridayFeelingRow {
  id: string;
  workspace_id: string;
  user_id: string;
  week_start: string;
  week_end: string;
  headline: string;
  tasks_handled: number;
  time_saved_minutes: number;
  trust_milestones: unknown[];
  generated_at: string;
  dismissed_at: string | null;
}

export async function getActiveFridayFeeling(
  client: SupabaseClient,
  workspaceId: string,
): Promise<FridayFeelingRow | null> {
  const { data, error } = await client
    .from('friday_feeling_summaries')
    .select('*')
    .eq('workspace_id', workspaceId)
    .is('dismissed_at', null)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as FridayFeelingRow;
}

export async function dismissFridayFeeling(
  client: SupabaseClient,
  workspaceId: string,
  summaryId: string,
): Promise<boolean> {
  const { error } = await client
    .from('friday_feeling_summaries')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', summaryId)
    .eq('workspace_id', workspaceId);

  return !error;
}

export interface WednesdayAffirmationRow {
  id: string;
  workspace_id: string;
  team_member_id: string;
  story: string;
  milestone: Record<string, unknown>;
  generated_at: string;
  dismissed_at: string | null;
}

export async function getActiveWednesdayAffirmation(
  client: SupabaseClient,
  workspaceId: string,
): Promise<WednesdayAffirmationRow | null> {
  const { data, error } = await client
    .from('wednesday_affirmations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .is('dismissed_at', null)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data as WednesdayAffirmationRow;
}

export async function dismissWednesdayAffirmation(
  client: SupabaseClient,
  workspaceId: string,
  affirmationId: string,
): Promise<boolean> {
  const { error } = await client
    .from('wednesday_affirmations')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', affirmationId)
    .eq('workspace_id', workspaceId);

  return !error;
}
