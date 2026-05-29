import { createServiceClient } from '@flow/db';
import type { WednesdayAffirmationInput, WednesdayAffirmationResult } from './schemas';

interface TrustTransitionRow {
  workspace_id: string;
  user_id: string;
  agent_id: string;
  from_level: string;
  to_level: string;
  created_at: string;
}

export async function executeWednesdayAffirmation(
  input: WednesdayAffirmationInput,
): Promise<WednesdayAffirmationResult> {
  const supabase = createServiceClient();
  const { workspaceId } = input;

  const { data: ws } = await supabase
    .from('workspaces')
    .select('is_agency')
    .eq('id', workspaceId)
    .single();

  if (!ws || !(ws as Record<string, unknown>).is_agency) {
    return { affirmationIds: [], generated: 0 };
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const since = sevenDaysAgo.toISOString();

  const { data: transitions } = await supabase
    .from('trust_transitions')
    .select('workspace_id, user_id, agent_id, from_level, to_level, created_at')
    .eq('workspace_id', workspaceId)
    .gte('created_at', since)
    .order('created_at', { ascending: true });

  if (!transitions || transitions.length === 0) {
    return { affirmationIds: [], generated: 0 };
  }

  const userIdSet = new Set(transitions.map((t: TrustTransitionRow) => t.user_id));
  const userIds = Array.from(userIdSet);
  const { data: members } = await supabase
    .from('users')
    .select('id, raw_user_meta_data')
    .in('id', userIds);

  const memberMap = new Map<string, string>();
  for (const m of (members ?? []) as Record<string, unknown>[]) {
    const meta = m.raw_user_meta_data as { full_name?: string } | null;
    memberMap.set(m.id as string, meta?.full_name ?? 'A team member');
  }

  type AffirmationRow = {
    workspace_id: string;
    team_member_id: string;
    story: string;
    milestone: { agent_type: string; trust_level: string };
  };

  const rows: AffirmationRow[] = [];

  for (const userId of userIds) {
    const memberTransitions = transitions.filter(
      (t: TrustTransitionRow) => t.user_id === userId,
    );
    if (memberTransitions.length === 0) continue;

    // Transitions are ordered ascending; last element is the most recent.
    const latest = memberTransitions[memberTransitions.length - 1] as TrustTransitionRow;
    const name = memberMap.get(userId) ?? 'A team member';
    const agentName = formatAgentName(latest.agent_id);

    rows.push({
      workspace_id: workspaceId,
      team_member_id: userId,
      story: `${name} reached ${latest.to_level} trust level for the ${agentName} this week.`,
      milestone: { agent_type: latest.agent_id, trust_level: latest.to_level },
    });
  }

  if (rows.length === 0) {
    return { affirmationIds: [], generated: 0 };
  }

  const { data: inserted, error } = await supabase
    .from('wednesday_affirmations')
    .insert(rows)
    .select('id');

  if (error || !inserted) {
    return { affirmationIds: [], generated: 0 };
  }

  const affirmationIds = inserted.map((r: { id: string }) => r.id);
  return { affirmationIds, generated: affirmationIds.length };
}

function formatAgentName(agentId: string): string {
  const names: Record<string, string> = {
    'time_integrity': 'Time Integrity Agent',
    'email_categorizer': 'Email Agent',
    'calendar': 'Calendar Agent',
    'weekly-report': 'Weekly Report Agent',
    'client-health': 'Client Health Agent',
    'morning_brief': 'Morning Brief Agent',
  };
  return names[agentId] ?? `${agentId.replace(/_/g, ' ')} Agent`;
}
