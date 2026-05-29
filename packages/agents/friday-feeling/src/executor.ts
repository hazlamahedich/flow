import { createServiceClient } from '@flow/db';
import type { FridayFeelingInput, FridayFeelingResult, TrustTransition } from './schemas';

const STANDARD_HEADLINE = "Here's what you accomplished. Now go live your life.";
const EMPTY_HEADLINE = "A quiet week means a blank canvas. \u{1f3a8} Your agents have been resting up and are fully charged to tackle whatever you throw at them next week! Unplug and have a wonderful weekend.";
const TIME_SAVED_PER_TASK_MINUTES = 5;

export async function execute(input: FridayFeelingInput): Promise<FridayFeelingResult> {
  const supabase = createServiceClient();
  const { workspaceId, userId, weekStart, weekEnd } = input;

  const { data: existing } = await supabase
    .from('friday_feeling_summaries')
    .select('id, tasks_handled, time_saved_minutes, trust_milestones, headline')
    .eq('workspace_id', workspaceId)
    .eq('week_start', weekStart)
    .maybeSingle();

  if (existing) {
    return {
      summaryId: existing.id,
      tasksHandled: existing.tasks_handled,
      timeSavedMinutes: existing.time_saved_minutes,
      trustMilestones: (existing.trust_milestones as TrustTransition[]) ?? [],
      headline: existing.headline,
    };
  }

  const { data: runs } = await supabase
    .from('agent_runs')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('status', 'completed')
    .gte('created_at', weekStart)
    .lte('created_at', weekEnd + 'T23:59:59');

  const tasksHandled = (runs ?? []).length;

  const { data: transitions } = await supabase
    .from('trust_transitions')
    .select('agent_id, from_level, to_level, created_at')
    .eq('workspace_id', workspaceId)
    .gte('created_at', weekStart)
    .lte('created_at', weekEnd + 'T23:59:59');

  const trustMilestones: TrustTransition[] = (transitions ?? []).map((t: Record<string, unknown>) => ({
    agent_type: t.agent_id as string,
    from_level: t.from_level as string,
    to_level: t.to_level as string,
    reached_at: t.created_at as string,
  }));

  const timeSavedMinutes = tasksHandled * TIME_SAVED_PER_TASK_MINUTES;
  const headline = tasksHandled === 0 && trustMilestones.length === 0 ? EMPTY_HEADLINE : STANDARD_HEADLINE;

  const { data: inserted, error: insertError } = await supabase
    .from('friday_feeling_summaries')
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      week_start: weekStart,
      week_end: weekEnd,
      headline,
      tasks_handled: tasksHandled,
      time_saved_minutes: timeSavedMinutes,
      trust_milestones: trustMilestones,
    })
    .select('id')
    .single();

  if (insertError) {
    throw new Error(`Failed to insert friday feeling summary: ${insertError.message}`);
  }

  return {
    summaryId: inserted.id,
    tasksHandled,
    timeSavedMinutes,
    trustMilestones,
    headline,
  };
}
