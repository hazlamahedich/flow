import { createServiceClient } from '../../client';
import { insertSignal } from '../agents/signals';

interface SaveBriefInput {
  workspace_id: string;
  brief_date: string;
  content: Record<string, unknown>;
  email_count_handled: number;
  email_count_attention: number;
  generation_status: 'pending' | 'generating' | 'completed' | 'failed';
  error_message?: string | null;
  flood_state?: boolean;
}

export async function saveMorningBrief(brief: SaveBriefInput) {
  const supabase = createServiceClient();

  try {
    const { data, error } = await supabase
      .from('morning_briefs')
      .upsert(
        {
          ...brief,
          generated_at: new Date().toISOString(),
          flood_state: brief.flood_state ?? false,
        },
        { onConflict: 'workspace_id, brief_date' }
      )
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('Upsert returned no data');

    const isFailed = data.generation_status === 'failed';
    const content = (data.content ?? {}) as Record<string, unknown>;
    const needsAttention = (content.needsAttentionItems ?? []) as Array<{ category: string }>;

    try {
      await insertSignal({
        workspaceId: data.workspace_id,
        agentId: 'inbox',
        signalType: isFailed ? 'morning_brief.generation_failed' : 'morning_brief.generated',
        correlationId: data.id,
        payload: {
          brief_id: data.id,
          workspace_id: data.workspace_id,
          urgent_count: needsAttention.filter(i => i.category === 'urgent').length,
          action_count: needsAttention.filter(i => i.category === 'action').length,
          handled_count: data.email_count_handled,
          client_count: ((content.clientBreakdown ?? []) as unknown[]).length,
          ...(isFailed ? { error_message: data.error_message } : {}),
        },
      });
    } catch (signalError) {
      console.error('Failed to emit brief signal (non-fatal):', signalError);
    }

    return data;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error during brief persistence';
    const name = error instanceof Error ? error.name : 'PersistenceError';

    try {
      await insertSignal({
        workspaceId: brief.workspace_id,
        agentId: 'inbox',
        signalType: 'morning_brief.generation_failed',
        correlationId: brief.workspace_id,
        payload: {
          workspace_id: brief.workspace_id,
          error_message: message,
          error_type: name,
        },
      });
    } catch (signalError) {
      console.error('Failed to emit failure signal (non-fatal):', signalError);
    }

    throw error;
  }
}
